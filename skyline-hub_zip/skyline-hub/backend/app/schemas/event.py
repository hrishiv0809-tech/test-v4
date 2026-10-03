from datetime import datetime
from decimal import Decimal
from pydantic import BaseModel
from app.models.event import EventStatus

class EventBase(BaseModel):
    title: str
    description: str | None = None
    location: str | None = None
    start_date: datetime
    end_date: datetime | None = None
    image_url: str | None = None
    capacity: int = 100
    member_price: Decimal = Decimal("0.00")
    non_member_price: Decimal = Decimal("0.00")
    status: EventStatus = EventStatus.PUBLISHED

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    location: str | None = None
    start_date: datetime | None = None
    end_date: datetime | None = None
    image_url: str | None = None
    capacity: int | None = None
    member_price: Decimal | None = None
    non_member_price: Decimal | None = None
    status: EventStatus | None = None

class EventResponse(EventBase):
    id: int
    tickets_sold: int = 0
    seats_left: int = 0
    is_sold_out: bool = False
    user_price: Decimal | None = None

    class Config:
        from_attributes = True

class EventReportResponse(BaseModel):
    event_id: int
    title: str
    capacity: int
    tickets_sold: int
    member_tickets_sold: int
    non_member_tickets_sold: int
    checked_in_count: int
    attendance_percent: float
    no_shows: int
    total_revenue: Decimal
    total_expenses: Decimal
    net_profit: Decimal
