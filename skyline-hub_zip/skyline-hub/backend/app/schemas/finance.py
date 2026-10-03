from datetime import datetime
from decimal import Decimal
from typing import List
from pydantic import BaseModel
from app.models.transaction import TransactionType, TransactionSource
from app.schemas.user import UserResponse

class TransactionResponse(BaseModel):
    id: int
    type: TransactionType
    source: TransactionSource
    amount: Decimal
    description: str
    reference_type: str | None = None
    reference_id: int | None = None
    date: datetime
    created_by_id: int | None = None
    created_by: UserResponse | None = None

    class Config:
        from_attributes = True

class FinanceKPIResponse(BaseModel):
    total_income: Decimal
    total_expenses: Decimal
    current_balance: Decimal
    pending_reimbursements: Decimal

class SourceBreakdownItem(BaseModel):
    source: str
    amount: Decimal

class MonthlyFinanceItem(BaseModel):
    month: str # e.g. "2025-01"
    income: Decimal
    expenses: Decimal

class ProfitLossItem(BaseModel):
    id: int
    type: str # "EVENT" or "FUNDRAISER"
    name: str
    revenue: Decimal
    expenses: Decimal
    net_profit: Decimal
