from decimal import Decimal
from datetime import datetime, date, timedelta
import io
import csv
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.models.transaction import Transaction, TransactionType, TransactionSource
from app.models.expense import ExpenseClaim, ExpenseStatus
from app.models.event import Event, EventStatus
from app.models.fundraiser import Fundraiser
from app.models.ticket import Ticket, TicketStatus
from app.schemas.finance import (
    FinanceKPIResponse, SourceBreakdownItem, MonthlyFinanceItem,
    TransactionResponse, ProfitLossItem
)

router = APIRouter(prefix="/finance", tags=["Finance & Ledger"])

@router.get("/kpi", response_model=FinanceKPIResponse)
def get_finance_kpi(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    total_income = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == TransactionType.INCOME
    ).scalar() or Decimal("0.00")

    total_expenses = db.query(func.sum(Transaction.amount)).filter(
        Transaction.type == TransactionType.EXPENSE
    ).scalar() or Decimal("0.00")

    current_balance = total_income - total_expenses

    pending_reimbursements = db.query(func.sum(ExpenseClaim.amount)).filter(
        ExpenseClaim.status.in_([ExpenseStatus.SUBMITTED, ExpenseStatus.APPROVED])
    ).scalar() or Decimal("0.00")

    return FinanceKPIResponse(
        total_income=total_income,
        total_expenses=total_expenses,
        current_balance=current_balance,
        pending_reimbursements=pending_reimbursements
    )

@router.get("/breakdown", response_model=List[SourceBreakdownItem])
def get_income_breakdown(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    results = db.query(
        Transaction.source,
        func.sum(Transaction.amount).label("total")
    ).filter(
        Transaction.type == TransactionType.INCOME
    ).group_by(Transaction.source).all()

    return [SourceBreakdownItem(source=r[0].value, amount=r[1]) for r in results]

@router.get("/monthly", response_model=List[MonthlyFinanceItem])
def get_monthly_finance(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    results = db.query(
        func.date_format(Transaction.date, "%Y-%m").label("month"),
        Transaction.type,
        func.sum(Transaction.amount).label("total")
    ).group_by(
        func.date_format(Transaction.date, "%Y-%m"),
        Transaction.type
    ).order_by(func.date_format(Transaction.date, "%Y-%m").asc()).all()

    months_map = {}
    for r in results:
        m, t, amt = r[0], r[1], r[2]
        if m not in months_map:
            months_map[m] = {"income": Decimal("0.00"), "expenses": Decimal("0.00")}
        if t == TransactionType.INCOME:
            months_map[m]["income"] = amt
        else:
            months_map[m]["expenses"] = amt

    return [
        MonthlyFinanceItem(month=k, income=v["income"], expenses=v["expenses"])
        for k, v in sorted(months_map.items())
    ]

@router.get("/transactions", response_model=dict)
def list_transactions(
    type_filter: Optional[str] = Query(None),
    source_filter: Optional[str] = Query(None),
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    q: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    query = db.query(Transaction).options(joinedload(Transaction.created_by))

    if type_filter:
        query = query.filter(Transaction.type == type_filter)
    if source_filter:
        query = query.filter(Transaction.source == source_filter)
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= datetime.combine(end_date, datetime.max.time()))
    if q:
        query = query.filter(Transaction.description.ilike(f"%{q}%"))

    total = query.count()
    txs = query.order_by(Transaction.date.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": [TransactionResponse.model_validate(t) for t in txs],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }

@router.get("/export-csv")
def export_transactions_csv(
    start_date: Optional[date] = Query(None),
    end_date: Optional[date] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    query = db.query(Transaction).options(joinedload(Transaction.created_by))
    if start_date:
        query = query.filter(Transaction.date >= start_date)
    if end_date:
        query = query.filter(Transaction.date <= datetime.combine(end_date, datetime.max.time()))

    txs = query.order_by(Transaction.date.asc()).all()

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["ID", "Date", "Type", "Source", "Amount", "Description", "Reference Type", "Reference ID"])

    for t in txs:
        writer.writerow([
            t.id,
            t.date.strftime("%Y-%m-%d %H:%M:%S"),
            t.type.value,
            t.source.value,
            f"{t.amount:.2f}",
            t.description,
            t.reference_type or "",
            t.reference_id or ""
        ])

    return Response(
        content=output.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=skyline_transactions_report.csv"}
    )

@router.get("/profit-loss", response_model=List[ProfitLossItem])
def get_profit_loss_breakdown(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    items = []

    events = db.query(Event).all()
    for e in events:
        rev = db.query(func.sum(Ticket.price_paid)).filter(
            Ticket.event_id == e.id,
            Ticket.status.in_([TicketStatus.VALID, TicketStatus.CHECKED_IN])
        ).scalar() or Decimal("0.00")

        exp = db.query(func.sum(ExpenseClaim.amount)).filter(
            ExpenseClaim.event_id == e.id,
            ExpenseClaim.status.in_([ExpenseStatus.APPROVED, ExpenseStatus.REIMBURSED])
        ).scalar() or Decimal("0.00")

        items.append(ProfitLossItem(
            id=e.id,
            type="EVENT",
            name=e.title,
            revenue=rev,
            expenses=exp,
            net_profit=rev - exp
        ))

    fundraisers = db.query(Fundraiser).all()
    for f in fundraisers:
        rev = f.raised_amount
        exp = db.query(func.sum(ExpenseClaim.amount)).filter(
            ExpenseClaim.fundraiser_id == f.id,
            ExpenseClaim.status.in_([ExpenseStatus.APPROVED, ExpenseStatus.REIMBURSED])
        ).scalar() or Decimal("0.00")

        items.append(ProfitLossItem(
            id=f.id,
            type="FUNDRAISER",
            name=f.title,
            revenue=rev,
            expenses=exp,
            net_profit=rev - exp
        ))

    return items
