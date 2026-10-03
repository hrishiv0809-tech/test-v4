from datetime import datetime, timezone, timedelta
from decimal import Decimal
from typing import List
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.models.membership import Membership, MembershipStatus
from app.models.event import Event, EventStatus
from app.models.ticket import Ticket, TicketStatus
from app.models.order import Order, OrderStatus
from app.models.task import FundraiserTask, TaskStatus
from app.models.expense import ExpenseClaim, ExpenseStatus
from app.models.transaction import Transaction, TransactionType
from app.schemas.dashboard import AdminDashboardResponse, RecentActivityItem

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])

@router.get("/admin", response_model=AdminDashboardResponse)
def get_admin_dashboard(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    now = datetime.now(timezone.utc)
    today = now.date()
    in_30_days = today + timedelta(days=30)
    seven_days_ago = now - timedelta(days=7)

    active_members = db.query(func.count(Membership.id)).filter(
        Membership.status == MembershipStatus.ACTIVE
    ).scalar() or 0

    members_expiring_soon = db.query(func.count(Membership.id)).filter(
        Membership.status == MembershipStatus.ACTIVE,
        Membership.end_date <= in_30_days,
        Membership.end_date >= today
    ).scalar() or 0

    upcoming_events = db.query(func.count(Event.id)).filter(
        Event.start_date >= now,
        Event.status == EventStatus.PUBLISHED
    ).scalar() or 0

    tickets_sold_this_week = db.query(func.count(Ticket.id)).filter(
        Ticket.created_at >= seven_days_ago,
        Ticket.status.in_([TicketStatus.VALID, TicketStatus.CHECKED_IN])
    ).scalar() or 0

    open_orders = db.query(func.count(Order.id)).filter(
        Order.status == OrderStatus.PAID
    ).scalar() or 0

    open_tasks = db.query(func.count(FundraiserTask.id)).filter(
        FundraiserTask.status.in_([TaskStatus.TODO, TaskStatus.IN_PROGRESS])
    ).scalar() or 0

    pending_claims = db.query(func.count(ExpenseClaim.id)).filter(
        ExpenseClaim.status == ExpenseStatus.SUBMITTED
    ).scalar() or 0

    total_income = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == TransactionType.INCOME
    ).scalar() or Decimal("0.00")
    total_expenses = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == TransactionType.EXPENSE
    ).scalar() or Decimal("0.00")
    current_balance = total_income - total_expenses

    recent_txs = db.query(Transaction).order_by(Transaction.date.desc()).limit(10).all()
    activity = []
    for t in recent_txs:
        activity.append(RecentActivityItem(
            id=str(t.id),
            type=t.type.value,
            description=t.description,
            timestamp=t.date,
            user_name=t.created_by.name if t.created_by else "System"
        ))

    return AdminDashboardResponse(
        active_members=active_members,
        members_expiring_soon=members_expiring_soon,
        upcoming_events=upcoming_events,
        tickets_sold_this_week=tickets_sold_this_week,
        open_orders=open_orders,
        open_tasks=open_tasks,
        pending_claims=pending_claims,
        current_balance=current_balance,
        recent_activity=activity
    )
