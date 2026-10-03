from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from app.core.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.models.ticket import Ticket, TicketStatus
from app.models.membership import Membership, MembershipStatus
from app.schemas.checkin import VerifyTicketResponse, VerifyMemberResponse
from app.schemas.ticket import TicketCheckInRequest

router = APIRouter(prefix="/checkin", tags=["Check-in & Verification"])

@router.post("/verify-ticket", response_model=VerifyTicketResponse)
def verify_ticket(
    req: TicketCheckInRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN, UserRole.VOLUNTEER, UserRole.TREASURER))
):
    code = req.ticket_code.strip()
    if code.startswith("SKYLINE_TICKET:"):
        code = code.replace("SKYLINE_TICKET:", "").strip()

    ticket = db.query(Ticket).filter(Ticket.ticket_code == code).options(joinedload(Ticket.event)).with_for_update().first()

    if not ticket:
        return VerifyTicketResponse(
            result="RED",
            status_text="INVALID TICKET",
            message="No ticket found with this code."
        )

    event_title = ticket.event.title if ticket.event else "Event"

    if ticket.status == TicketStatus.CHECKED_IN:
        checked_time_str = ticket.checked_in_at.strftime("%I:%M %p on %b %d, %Y") if ticket.checked_in_at else "earlier"
        return VerifyTicketResponse(
            result="YELLOW",
            status_text="ALREADY CHECKED IN",
            message=f"Ticket already used by {ticket.buyer_name} at {checked_time_str}.",
            ticket_id=ticket.id,
            buyer_name=ticket.buyer_name,
            event_title=event_title,
            checked_in_at=ticket.checked_in_at
        )

    if ticket.status == TicketStatus.CANCELLED:
        return VerifyTicketResponse(
            result="RED",
            status_text="CANCELLED TICKET",
            message="This ticket has been cancelled.",
            ticket_id=ticket.id,
            buyer_name=ticket.buyer_name,
            event_title=event_title
        )

    now = datetime.now(timezone.utc)
    ticket.status = TicketStatus.CHECKED_IN
    ticket.checked_in_at = now
    ticket.checked_in_by_id = current_user.id
    db.commit()

    return VerifyTicketResponse(
        result="GREEN",
        status_text="WELCOME",
        message=f"Welcome, {ticket.buyer_name}! Ticket valid for {event_title}.",
        ticket_id=ticket.id,
        buyer_name=ticket.buyer_name,
        event_title=event_title,
        checked_in_at=now
    )

@router.get("/verify-member", response_model=VerifyMemberResponse)
def verify_member(
    query: str = Query(..., description="Member code, student ID, or email"),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.VOLUNTEER, UserRole.TREASURER))
):
    raw_query = query.strip()
    if raw_query.startswith("SKYLINE_MEMBER:"):
        raw_query = raw_query.replace("SKYLINE_MEMBER:", "").strip()

    membership = db.query(Membership).join(Membership.user).options(
        joinedload(Membership.user),
        joinedload(Membership.plan)
    ).filter(
        (Membership.member_code == raw_query) |
        (User.student_id == raw_query) |
        (User.email == raw_query)
    ).order_by(Membership.id.desc()).first()

    if not membership or not membership.user:
        return VerifyMemberResponse(
            result="RED",
            status_text="NOT A MEMBER",
            member_name="Unknown",
            member_code=raw_query
        )

    if membership.status == MembershipStatus.ACTIVE:
        return VerifyMemberResponse(
            result="GREEN",
            status_text="ACTIVE MEMBER",
            member_name=membership.user.name,
            member_code=membership.member_code,
            plan_name=membership.plan.name if membership.plan else None,
            expiry_date=membership.end_date.isoformat() if membership.end_date else None
        )
    else:
        return VerifyMemberResponse(
            result="RED",
            status_text="NOT A MEMBER / EXPIRED",
            member_name=membership.user.name,
            member_code=membership.member_code,
            plan_name=membership.plan.name if membership.plan else None,
            expiry_date=membership.end_date.isoformat() if membership.end_date else None
        )
