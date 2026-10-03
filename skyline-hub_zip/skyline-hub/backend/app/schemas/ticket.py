from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel, EmailStr
from app.models.ticket import TicketStatus
from app.schemas.event import EventResponse

class TicketPurchaseRequest(BaseModel):
    event_id: int
    buyer_name: str
    buyer_email: EmailStr

class TicketResponse(BaseModel):
    id: int
    event_id: int
    user_id: int | None = None
    buyer_name: str
    buyer_email: str
    price_paid: Decimal
    is_member_price: bool
    ticket_code: str
    status: TicketStatus
    checked_in_at: datetime | None = None
    checked_in_by_id: int | None = None
    created_at: datetime
    event: EventResponse | None = None

    class Config:
        from_attributes = True

class TicketCheckInRequest(BaseModel):
    ticket_code: str
