from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from app.models.expense import ExpenseStatus
from app.schemas.user import UserResponse

class ExpenseClaimBase(BaseModel):
    description: str
    amount: Decimal
    category: str
    receipt_url: str
    fundraiser_id: int | None = None
    event_id: int | None = None

class ExpenseClaimCreate(ExpenseClaimBase):
    pass

class ExpenseReviewRequest(BaseModel):
    status: ExpenseStatus # APPROVED, REJECTED, REIMBURSED
    review_note: str | None = None

class ExpenseClaimResponse(ExpenseClaimBase):
    id: int
    submitted_by_id: int
    status: ExpenseStatus
    reviewed_by_id: int | None = None
    review_note: str | None = None
    created_at: datetime
    reimbursed_at: datetime | None = None
    submitted_by: UserResponse | None = None
    reviewed_by: UserResponse | None = None

    class Config:
        from_attributes = True
