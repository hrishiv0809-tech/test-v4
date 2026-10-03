from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.deps import get_db, get_optional_current_user, require_roles
from app.models.user import User, UserRole
from app.models.event import Event, EventStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.expense import ExpenseClaim, ExpenseStatus
from app.models.membership import Membership, MembershipStatus
from app.schemas.event import EventResponse, EventCreate, EventUpdate, EventReportResponse

router = APIRouter(prefix="/events", tags=["Events"])

def _populate_event_metadata(event: Event, db: Session, current_user: Optional[User]) -> EventResponse:
    tickets_sold = db.query(func.count(Ticket.id)).filter(
        Ticket.event_id == event.id,
        Ticket.status.in_([TicketStatus.VALID, TicketStatus.CHECKED_IN])
    ).scalar() or 0
    
    seats_left = max(0, event.capacity - tickets_sold)
    is_sold_out = seats_left <= 0

    user_price = event.non_member_price
    if current_user:
        active_mem = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.ACTIVE
        ).first()
        if active_mem:
            user_price = event.member_price

    resp = EventResponse.model_validate(event)
    resp.tickets_sold = tickets_sold
    resp.seats_left = seats_left
    resp.is_sold_out = is_sold_out
    resp.user_price = user_price
    return resp

@router.get("", response_model=List[EventResponse])
def list_events(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    query = db.query(Event)
    if status_filter:
        query = query.filter(Event.status == status_filter)
    elif not current_user or current_user.role not in [UserRole.ADMIN, UserRole.TREASURER]:
        query = query.filter(Event.status.in_([EventStatus.PUBLISHED, EventStatus.COMPLETED]))
    
    events = query.order_by(Event.start_date.asc()).all()
    return [_populate_event_metadata(e, db, current_user) for e in events]

@router.post("", response_model=EventResponse)
def create_event(
    req: EventCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    event = Event(**req.model_dump())
    db.add(event)
    db.commit()
    db.refresh(event)
    return _populate_event_metadata(event, db, None)

@router.get("/{id}", response_model=EventResponse)
def get_event(
    id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    event = db.query(Event).filter(Event.id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    return _populate_event_metadata(event, db, current_user)

@router.patch("/{id}", response_model=EventResponse)
def update_event(
    id: int,
    req: EventUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    event = db.query(Event).filter(Event.id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    
    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(event, k, v)
    
    db.commit()
    db.refresh(event)
    return _populate_event_metadata(event, db, None)

@router.delete("/{id}")
def delete_event(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    event = db.query(Event).filter(Event.id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")
    db.delete(event)
    db.commit()
    return {"message": "Event deleted successfully"}

@router.get("/{id}/report", response_model=EventReportResponse)
def get_event_report(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    event = db.query(Event).filter(Event.id == id).first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    tickets = db.query(Ticket).filter(
        Ticket.event_id == id,
        Ticket.status.in_([TicketStatus.VALID, TicketStatus.CHECKED_IN])
    ).all()

    tickets_sold = len(tickets)
    member_tickets_sold = sum(1 for t in tickets if t.is_member_price)
    non_member_tickets_sold = tickets_sold - member_tickets_sold
    checked_in_count = sum(1 for t in tickets if t.status == TicketStatus.CHECKED_IN)
    no_shows = tickets_sold - checked_in_count
    attendance_percent = round((checked_in_count / tickets_sold * 100) if tickets_sold > 0 else 0.0, 2)
    total_revenue = sum((t.price_paid for t in tickets), Decimal("0.00"))

    # Linked approved/reimbursed expenses
    expenses = db.query(ExpenseClaim).filter(
        ExpenseClaim.event_id == id,
        ExpenseClaim.status.in_([ExpenseStatus.APPROVED, ExpenseStatus.REIMBURSED])
    ).all()
    total_expenses = sum((e.amount for e in expenses), Decimal("0.00"))
    net_profit = total_revenue - total_expenses

    return EventReportResponse(
        event_id=event.id,
        title=event.title,
        capacity=event.capacity,
        tickets_sold=tickets_sold,
        member_tickets_sold=member_tickets_sold,
        non_member_tickets_sold=non_member_tickets_sold,
        checked_in_count=checked_in_count,
        attendance_percent=attendance_percent,
        no_shows=no_shows,
        total_revenue=total_revenue,
        total_expenses=total_expenses,
        net_profit=net_profit
    )
