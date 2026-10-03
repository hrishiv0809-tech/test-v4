from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
import io
import csv
import uuid
from typing import Optional, List
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload
from app.core.deps import get_db, require_roles, get_current_user
from app.core.config import settings
from app.core.security import get_password_hash
from app.models.user import User, UserRole
from app.models.membership import Membership, MembershipStatus
from app.models.membership_plan import MembershipPlan
from app.models.ticket import Ticket
from app.models.order import Order, OrderItem
from app.models.product import ProductVariant, Product
from app.models.transaction import TransactionType, TransactionSource
from app.schemas.membership import MembershipResponse, QuickAddMemberRequest
from app.schemas.ticket import TicketResponse
from app.schemas.order import OrderResponse
from app.services.transaction_service import transaction_service
from pydantic import BaseModel

class MemberProfileResponse(BaseModel):
    membership: MembershipResponse
    tickets: List[TicketResponse] = []
    orders: List[OrderResponse] = []

router = APIRouter(prefix="/members", tags=["Members"])

@router.get("", response_model=dict)
def list_members(
    q: Optional[str] = Query(None, description="Search by name, email or student_id"),
    status_filter: Optional[str] = Query(None, description="ACTIVE, EXPIRED, PENDING_PAYMENT, EXPIRING_30"),
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER, UserRole.VOLUNTEER))
):
    query = db.query(Membership).join(Membership.user).options(
        joinedload(Membership.user),
        joinedload(Membership.plan)
    )

    if q:
        search = f"%{q}%"
        query = query.filter(
            (User.name.ilike(search)) |
            (User.email.ilike(search)) |
            (User.student_id.ilike(search)) |
            (Membership.member_code.ilike(search))
        )

    today = date.today()
    if status_filter == "ACTIVE":
        query = query.filter(Membership.status == MembershipStatus.ACTIVE)
    elif status_filter == "EXPIRED":
        query = query.filter(Membership.status == MembershipStatus.EXPIRED)
    elif status_filter == "PENDING_PAYMENT":
        query = query.filter(Membership.status == MembershipStatus.PENDING_PAYMENT)
    elif status_filter == "EXPIRING_30":
        in_30_days = today + timedelta(days=30)
        query = query.filter(
            Membership.status == MembershipStatus.ACTIVE,
            Membership.end_date <= in_30_days,
            Membership.end_date >= today
        )

    total = query.count()
    memberships = query.order_by(Membership.id.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": [MembershipResponse.model_validate(m) for m in memberships],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@router.get("/export-csv")
def export_members_csv(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    memberships = db.query(Membership).join(Membership.user).options(
        joinedload(Membership.user),
        joinedload(Membership.plan)
    ).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Member Code", "Name", "Email", "Phone", "Student ID", 
        "Plan", "Status", "Dues Paid", "Amount Paid", "Start Date", "End Date"
    ])

    for m in memberships:
        writer.writerow([
            m.member_code,
            m.user.name if m.user else "",
            m.user.email if m.user else "",
            m.user.phone if m.user else "",
            m.user.student_id if m.user else "",
            m.plan.name if m.plan else "",
            m.status.value,
            "Yes" if m.dues_paid else "No",
            f"{m.amount_paid:.2f}",
            m.start_date.isoformat() if m.start_date else "",
            m.end_date.isoformat() if m.end_date else ""
        ])

    csv_content = output.getvalue()
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=skyline_members.csv"}
    )

@router.post("/quick-add", response_model=MembershipResponse)
def quick_add_member(
    req: QuickAddMemberRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    plan = db.query(MembershipPlan).filter(MembershipPlan.id == req.plan_id).first()
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found")

    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        temp_password = uuid.uuid4().hex[:10]
        user = User(
            name=req.name,
            email=req.email,
            password_hash=get_password_hash(temp_password),
            phone=req.phone,
            student_id=req.student_id,
            role=UserRole.MEMBER
        )
        db.add(user)
        db.flush()

    today = date.today()
    academic_year = today.year if today.month <= settings.ACADEMIC_YEAR_END_MONTH else today.year + 1
    end_date = date(academic_year, settings.ACADEMIC_YEAR_END_MONTH, settings.ACADEMIC_YEAR_END_DAY)

    member_code = f"SKY-{uuid.uuid4().hex[:8].upper()}"
    membership = Membership(
        user_id=user.id,
        plan_id=plan.id,
        status=MembershipStatus.ACTIVE if req.mark_dues_paid else MembershipStatus.PENDING_PAYMENT,
        start_date=today if req.mark_dues_paid else None,
        end_date=end_date if req.mark_dues_paid else None,
        dues_paid=req.mark_dues_paid,
        amount_paid=plan.price if req.mark_dues_paid else Decimal("0.00"),
        member_code=member_code
    )
    db.add(membership)
    db.flush()

    if req.mark_dues_paid:
        transaction_service.record_transaction(
            db=db,
            type=TransactionType.INCOME,
            source=TransactionSource.DUES,
            amount=plan.price,
            description=f"Membership dues paid (cash/table sign-up): {user.name} ({plan.name})",
            reference_type="MEMBERSHIP",
            reference_id=membership.id,
            created_by_id=current_user.id
        )

    db.commit()
    db.refresh(membership)
    return membership

@router.get("/{id}/profile", response_model=MemberProfileResponse)
def get_member_profile(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    membership = db.query(Membership).filter(Membership.id == id).options(
        joinedload(Membership.user),
        joinedload(Membership.plan)
    ).first()
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")

    if current_user.role not in [UserRole.ADMIN, UserRole.TREASURER] and current_user.id != membership.user_id:
        raise HTTPException(status_code=403, detail="Forbidden")

    tickets = db.query(Ticket).filter(Ticket.user_id == membership.user_id).options(joinedload(Ticket.event)).order_by(Ticket.id.desc()).all()
    orders = db.query(Order).filter(Order.user_id == membership.user_id).options(
        joinedload(Order.items).joinedload(OrderItem.variant).joinedload(ProductVariant.product)
    ).order_by(Order.id.desc()).all()

    return MemberProfileResponse(
        membership=MembershipResponse.model_validate(membership),
        tickets=[TicketResponse.model_validate(t) for t in tickets],
        orders=[OrderResponse.model_validate(o) for o in orders]
    )
