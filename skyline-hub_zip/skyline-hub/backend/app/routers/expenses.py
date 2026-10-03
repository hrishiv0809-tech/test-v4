from datetime import datetime, timezone
from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from app.core.deps import get_db, get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.expense import ExpenseClaim, ExpenseStatus
from app.models.transaction import TransactionType, TransactionSource
from app.schemas.expense import ExpenseClaimResponse, ExpenseClaimCreate, ExpenseReviewRequest
from app.services.transaction_service import transaction_service

router = APIRouter(prefix="/expenses", tags=["Expenses & Reimbursements"])

@router.get("", response_model=List[ExpenseClaimResponse])
def list_expenses(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    query = db.query(ExpenseClaim).options(
        joinedload(ExpenseClaim.submitted_by),
        joinedload(ExpenseClaim.reviewed_by)
    )
    if status_filter:
        query = query.filter(ExpenseClaim.status == status_filter)
    return query.order_by(ExpenseClaim.id.desc()).all()

@router.get("/my-claims", response_model=List[ExpenseClaimResponse])
def get_my_claims(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return db.query(ExpenseClaim).filter(
        ExpenseClaim.submitted_by_id == current_user.id
    ).options(
        joinedload(ExpenseClaim.submitted_by),
        joinedload(ExpenseClaim.reviewed_by)
    ).order_by(ExpenseClaim.id.desc()).all()

@router.post("", response_model=ExpenseClaimResponse)
def submit_expense_claim(
    req: ExpenseClaimCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not req.receipt_url:
        raise HTTPException(status_code=400, detail="A receipt image/document is required to submit an expense claim.")

    claim = ExpenseClaim(
        submitted_by_id=current_user.id,
        description=req.description,
        amount=req.amount,
        category=req.category,
        receipt_url=req.receipt_url,
        fundraiser_id=req.fundraiser_id,
        event_id=req.event_id,
        status=ExpenseStatus.SUBMITTED
    )
    db.add(claim)
    db.commit()
    db.refresh(claim)
    return claim

@router.patch("/{id}/review", response_model=ExpenseClaimResponse)
def review_expense_claim(
    id: int,
    req: ExpenseReviewRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    claim = db.query(ExpenseClaim).filter(ExpenseClaim.id == id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="Expense claim not found")

    claim.status = req.status
    claim.review_note = req.review_note
    claim.reviewed_by_id = current_user.id

    if req.status == ExpenseStatus.REIMBURSED:
        now = datetime.now(timezone.utc)
        claim.reimbursed_at = now

        transaction_service.record_transaction(
            db=db,
            type=TransactionType.EXPENSE,
            source=TransactionSource.REIMBURSEMENT,
            amount=claim.amount,
            description=f"Reimbursement to {claim.submitted_by.name if claim.submitted_by else 'User'}: {claim.description}",
            reference_type="EXPENSE_CLAIM",
            reference_id=claim.id,
            created_by_id=current_user.id
        )

    db.commit()
    db.refresh(claim)
    return claim
