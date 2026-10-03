from datetime import date
from decimal import Decimal
from typing import List
from pydantic import BaseModel
from app.models.fundraiser import FundraiserStatus
from app.schemas.task import TaskResponse

class FundraiserBase(BaseModel):
    title: str
    description: str | None = None
    goal_amount: Decimal
    event_date: date | None = None
    status: FundraiserStatus = FundraiserStatus.PLANNING

class FundraiserCreate(FundraiserBase):
    pass

class FundraiserUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    goal_amount: Decimal | None = None
    event_date: date | None = None
    status: FundraiserStatus | None = None

class FundraiserResponse(FundraiserBase):
    id: int
    raised_amount: Decimal
    tasks_count: int = 0
    done_tasks_count: int = 0
    percent_done: float = 0.0
    is_at_risk: bool = False
    tasks: List[TaskResponse] = []

    class Config:
        from_attributes = True

class RecordIncomeRequest(BaseModel):
    amount: Decimal
    description: str
