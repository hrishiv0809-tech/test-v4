from decimal import Decimal
from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.core.deps import get_db, get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.fundraiser import Fundraiser, FundraiserStatus
from app.models.task import FundraiserTask, TaskStatus
from app.models.transaction import TransactionType, TransactionSource
from app.schemas.fundraiser import FundraiserResponse, FundraiserCreate, FundraiserUpdate, RecordIncomeRequest
from app.schemas.task import TaskResponse
from app.services.transaction_service import transaction_service

router = APIRouter(prefix="/fundraisers", tags=["Fundraisers"])

def _build_fundraiser_response(f: Fundraiser) -> FundraiserResponse:
    tasks = f.tasks or []
    tasks_count = len(tasks)
    done_count = sum(1 for t in tasks if t.status == TaskStatus.DONE)
    percent_done = round((done_count / tasks_count * 100) if tasks_count > 0 else 0.0, 1)

    today = date.today()
    has_overdue = any(t.due_date and t.due_date < today and t.status != TaskStatus.DONE for t in tasks)
    
    is_at_risk = False
    if has_overdue:
        is_at_risk = True
    elif f.event_date and (f.event_date - today).days <= 3 and percent_done < 50.0:
        is_at_risk = True

    task_responses = []
    for t in sorted(tasks, key=lambda x: x.position):
        tr = TaskResponse.model_validate(t)
        tr.is_overdue = bool(t.due_date and t.due_date < today and t.status != TaskStatus.DONE)
        task_responses.append(tr)

    resp = FundraiserResponse.model_validate(f)
    resp.tasks_count = tasks_count
    resp.done_tasks_count = done_count
    resp.percent_done = percent_done
    resp.is_at_risk = is_at_risk
    resp.tasks = task_responses
    return resp

@router.get("", response_model=List[FundraiserResponse])
def list_fundraisers(db: Session = Depends(get_db)):
    fundraisers = db.query(Fundraiser).options(
        joinedload(Fundraiser.tasks).joinedload(FundraiserTask.assignee)
    ).order_by(Fundraiser.id.desc()).all()
    return [_build_fundraiser_response(f) for f in fundraisers]

@router.post("", response_model=FundraiserResponse)
def create_fundraiser(
    req: FundraiserCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    fundraiser = Fundraiser(**req.model_dump())
    db.add(fundraiser)
    db.commit()
    db.refresh(fundraiser)
    return _build_fundraiser_response(fundraiser)

@router.get("/{id}", response_model=FundraiserResponse)
def get_fundraiser(id: int, db: Session = Depends(get_db)):
    fundraiser = db.query(Fundraiser).filter(Fundraiser.id == id).options(
        joinedload(Fundraiser.tasks).joinedload(FundraiserTask.assignee)
    ).first()
    if not fundraiser:
        raise HTTPException(status_code=404, detail="Fundraiser not found")
    return _build_fundraiser_response(fundraiser)

@router.patch("/{id}", response_model=FundraiserResponse)
def update_fundraiser(
    id: int,
    req: FundraiserUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    fundraiser = db.query(Fundraiser).filter(Fundraiser.id == id).first()
    if not fundraiser:
        raise HTTPException(status_code=404, detail="Fundraiser not found")
    
    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(fundraiser, k, v)

    db.commit()
    db.refresh(fundraiser)
    return _build_fundraiser_response(fundraiser)

@router.post("/{id}/record-income", response_model=FundraiserResponse)
def record_fundraiser_income(
    id: int,
    req: RecordIncomeRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    fundraiser = db.query(Fundraiser).filter(Fundraiser.id == id).first()
    if not fundraiser:
        raise HTTPException(status_code=404, detail="Fundraiser not found")

    fundraiser.raised_amount += req.amount

    transaction_service.record_transaction(
        db=db,
        type=TransactionType.INCOME,
        source=TransactionSource.FUNDRAISER,
        amount=req.amount,
        description=f"Fundraiser income ({fundraiser.title}): {req.description}",
        reference_type="FUNDRAISER",
        reference_id=fundraiser.id,
        created_by_id=current_user.id
    )

    db.commit()
    db.refresh(fundraiser)
    return _build_fundraiser_response(fundraiser)
