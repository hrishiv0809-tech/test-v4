from datetime import date
from decimal import Decimal
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.core.deps import get_db, get_current_user, require_roles
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.membership import Membership, MembershipStatus
from app.models.membership_plan import MembershipPlan
from app.models.transaction import TransactionType, TransactionSource
from app.schemas.membership import (
    MembershipPlanResponse, MembershipPlanCreate,
    MembershipResponse, SubscribeRequest, PayDuesRequest
)
from app.services.transaction_service import transaction_service
from app.services.qr_service import qr_service
from app.services.scheduler import process_renewal_reminders_and_expirations

router = APIRouter(prefix="/memberships", tags=["Memberships"])

@router.get("/plans", response_model=List[MembershipPlanResponse])
def get_plans(db: Session = Depends(get_db)):
    return db.query(MembershipPlan).all()

@router.post("/plans", response_model=MembershipPlanResponse)
def create_plan(
    req: MembershipPlanCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    plan = MembershipPlan(**req.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan

@router.get("/my-membership", response_model=MembershipResponse | None)
def get_my_membership(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id
    ).options(joinedload(Membership.plan), joinedload(Membership.user)).order_by(Membership.id.desc()).first()
    return membership

@router.post("/subscribe", response_model=MembershipResponse)
def subscribe(
    req: SubscribeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    plan = db.query(MembershipPlan).filter(MembershipPlan.id == req.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")

    existing = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.status == MembershipStatus.ACTIVE
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="You already have an active membership.")

    member_code = f"SKY-{uuid.uuid4().hex[:8].upper()}"
    membership = Membership(
        user_id=current_user.id,
        plan_id=plan.id,
        status=MembershipStatus.PENDING_PAYMENT,
        dues_paid=False,
        amount_paid=Decimal("0.00"),
        member_code=member_code
    )
    db.add(membership)
    db.commit()
    db.refresh(membership)
    return membership

@router.post("/pay-dues", response_model=MembershipResponse)
def pay_dues(
    req: PayDuesRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    membership = db.query(Membership).filter(Membership.id == req.membership_id).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    if current_user.role != UserRole.ADMIN and membership.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Access forbidden")

    if membership.status == MembershipStatus.ACTIVE and membership.dues_paid:
        return membership

    plan = db.query(MembershipPlan).filter(MembershipPlan.id == membership.plan_id).first()
    today = date.today()
    academic_year = today.year if today.month <= settings.ACADEMIC_YEAR_END_MONTH else today.year + 1
    end_date = date(academic_year, settings.ACADEMIC_YEAR_END_MONTH, settings.ACADEMIC_YEAR_END_DAY)

    membership.status = MembershipStatus.ACTIVE
    membership.dues_paid = True
    membership.amount_paid = plan.price if plan else Decimal("0.00")
    membership.start_date = today
    membership.end_date = end_date
    membership.renewal_reminder_sent = False

    # Record single source of truth transaction
    transaction_service.record_transaction(
        db=db,
        type=TransactionType.INCOME,
        source=TransactionSource.DUES,
        amount=membership.amount_paid,
        description=f"Membership dues paid: {membership.user.name if membership.user else 'User'} ({plan.name if plan else 'Plan'})",
        reference_type="MEMBERSHIP",
        reference_id=membership.id,
        created_by_id=current_user.id
    )

    db.commit()
    db.refresh(membership)
    return membership

@router.get("/card-qr")
def get_member_card_qr(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    membership = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.status == MembershipStatus.ACTIVE
    ).first()
    if not membership:
        raise HTTPException(status_code=400, detail="No active membership found")

    qr_data = f"SKYLINE_MEMBER:{membership.member_code}"
    qr_data_url = qr_service.generate_qr_code_base64(qr_data)
    return {
        "member_code": membership.member_code,
        "qr_code": qr_data_url,
        "status": membership.status.value,
        "end_date": membership.end_date.isoformat() if membership.end_date else None
    }

@router.post("/send-reminders")
def send_reminders_now(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    process_renewal_reminders_and_expirations()
    return {"message": "Renewal reminders check triggered and processed successfully."}
