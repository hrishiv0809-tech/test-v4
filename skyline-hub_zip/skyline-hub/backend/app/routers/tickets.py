from decimal import Decimal
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.deps import get_db, get_current_user, get_optional_current_user, require_roles
from app.models.user import User, UserRole
from app.models.event import Event, EventStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.membership import Membership, MembershipStatus
from app.models.transaction import TransactionType, TransactionSource
from app.schemas.ticket import TicketPurchaseRequest, TicketResponse
from app.services.transaction_service import transaction_service
from app.services.email_service import email_service
from app.services.qr_service import qr_service

router = APIRouter(prefix="/tickets", tags=["Tickets"])

@router.post("/purchase", response_model=TicketResponse)
def purchase_ticket(
    req: TicketPurchaseRequest,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    event = db.query(Event).filter(Event.id == req.event_id).with_for_update().first()
    if not event:
        raise HTTPException(status_code=404, detail="Event not found")

    if event.status != EventStatus.PUBLISHED:
        raise HTTPException(status_code=400, detail="This event is not open for ticket sales.")

    sold_count = db.query(func.count(Ticket.id)).filter(
        Ticket.event_id == event.id,
        Ticket.status.in_([TicketStatus.VALID, TicketStatus.CHECKED_IN])
    ).scalar() or 0

    if sold_count >= event.capacity:
        raise HTTPException(status_code=400, detail="Sorry, this event is sold out.")

    is_member = False
    price_to_pay = event.non_member_price
    user_id = None

    if current_user:
        user_id = current_user.id
        active_mem = db.query(Membership).filter(
            Membership.user_id == current_user.id,
            Membership.status == MembershipStatus.ACTIVE
        ).first()
        if active_mem:
            is_member = True
            price_to_pay = event.member_price

    ticket_code = f"TCK-{uuid.uuid4().hex[:10].upper()}"
    ticket = Ticket(
        event_id=event.id,
        user_id=user_id,
        buyer_name=req.buyer_name,
        buyer_email=req.buyer_email,
        price_paid=price_to_pay,
        is_member_price=is_member,
        ticket_code=ticket_code,
        status=TicketStatus.VALID
    )
    db.add(ticket)
    db.flush()

    transaction_service.record_transaction(
        db=db,
        type=TransactionType.INCOME,
        source=TransactionSource.TICKET,
        amount=price_to_pay,
        description=f"Ticket purchase: {event.title} ({req.buyer_name})",
        reference_type="TICKET",
        reference_id=ticket.id,
        created_by_id=user_id
    )

    email_body = (
        f"Hello {req.buyer_name},\n\n"
        f"Thank you for purchasing a ticket for {event.title}!\n"
        f"Ticket Code: {ticket_code}\n"
        f"Price Paid: USD {float(price_to_pay):.2f}\n"
        f"Date & Time: {event.start_date}\n"
        f"Location: {event.location or 'TBA'}\n\n"
        f"Please present this code or your digital ticket QR at the door.\n\n"
        f"Skyline Student Association"
    )

    email_service.send_and_log_email(
        db=db,
        to_email=req.buyer_email,
        subject=f"Your Ticket for {event.title} - Skyline Hub",
        body=email_body,
        related_type="TICKET",
        related_id=ticket.id
    )

    db.commit()
    db.refresh(ticket)
    return ticket

@router.get("/my-tickets", response_model=List[TicketResponse])
def get_my_tickets(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tickets = db.query(Ticket).filter(
        (Ticket.user_id == current_user.id) | (Ticket.buyer_email == current_user.email)
    ).options(joinedload(Ticket.event)).order_by(Ticket.id.desc()).all()
    return tickets

@router.get("/{id}/qr")
def get_ticket_qr(
    id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    ticket = db.query(Ticket).filter(Ticket.id == id).first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    if current_user.role not in [UserRole.ADMIN, UserRole.VOLUNTEER] and ticket.user_id != current_user.id and ticket.buyer_email != current_user.email:
        raise HTTPException(status_code=403, detail="Forbidden")

    qr_payload = f"SKYLINE_TICKET:{ticket.ticket_code}"
    qr_data = qr_service.generate_qr_code_base64(qr_payload)
    return {
        "ticket_code": ticket.ticket_code,
        "qr_code": qr_data,
        "status": ticket.status.value
    }
