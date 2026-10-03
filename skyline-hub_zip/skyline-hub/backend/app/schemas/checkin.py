from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel

class VerifyTicketResponse(BaseModel):
    result: str # "GREEN", "YELLOW", "RED"
    status_text: str
    message: str
    ticket_id: int | None = None
    buyer_name: str | None = None
    event_title: str | None = None
    checked_in_at: datetime | None = None

class VerifyMemberResponse(BaseModel):
    result: str # "GREEN", "RED"
    status_text: str # "ACTIVE MEMBER", "NOT A MEMBER / EXPIRED"
    member_name: str | None = None
    member_code: str | None = None
    plan_name: str | None = None
    expiry_date: str | None = None
