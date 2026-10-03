from datetime import date
from decimal import Decimal
from pydantic import BaseModel, EmailStr
from app.models.membership import MembershipStatus
from app.schemas.user import UserResponse

class MembershipPlanBase(BaseModel):
    name: str
    price: Decimal
    duration_months: int = 12
    ticket_discount_percent: int = 0
    merch_discount_percent: int = 0
    benefits: str | None = None

class MembershipPlanCreate(MembershipPlanBase):
    pass

class MembershipPlanResponse(MembershipPlanBase):
    id: int

    class Config:
        from_attributes = True

class MembershipResponse(BaseModel):
    id: int
    user_id: int
    plan_id: int
    status: MembershipStatus
    start_date: date | None = None
    end_date: date | None = None
    dues_paid: bool
    amount_paid: Decimal
    member_code: str
    renewal_reminder_sent: bool
    plan: MembershipPlanResponse | None = None
    user: UserResponse | None = None

    class Config:
        from_attributes = True

class SubscribeRequest(BaseModel):
    plan_id: int

class QuickAddMemberRequest(BaseModel):
    name: str
    email: EmailStr
    phone: str | None = None
    student_id: str | None = None
    plan_id: int
    mark_dues_paid: bool = False

class PayDuesRequest(BaseModel):
    membership_id: int
