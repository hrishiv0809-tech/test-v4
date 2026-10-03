from datetime import datetime, timezone
from decimal import Decimal
import enum
from sqlalchemy import String, DateTime, Text, Numeric, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class ExpenseStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REJECTED = "REJECTED"
    REIMBURSED = "REIMBURSED"

class ExpenseClaim(Base):
    __tablename__ = "expense_claims"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    submitted_by_id: Mapped[int] = mapped_column(ForeignKey("users.id"), nullable=False, index=True)
    fundraiser_id: Mapped[int | None] = mapped_column(ForeignKey("fundraisers.id", ondelete="SET NULL"), nullable=True, index=True)
    event_id: Mapped[int | None] = mapped_column(ForeignKey("events.id", ondelete="SET NULL"), nullable=True, index=True)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    category: Mapped[str] = mapped_column(String(100), nullable=False)
    receipt_url: Mapped[str] = mapped_column(String(500), nullable=False)
    status: Mapped[ExpenseStatus] = mapped_column(Enum(ExpenseStatus), default=ExpenseStatus.SUBMITTED, nullable=False, index=True)
    reviewed_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)
    reimbursed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    submitted_by: Mapped["User"] = relationship("User", back_populates="expense_claims", foreign_keys=[submitted_by_id])
    reviewed_by: Mapped["User | None"] = relationship("User", foreign_keys=[reviewed_by_id])
    fundraiser: Mapped["Fundraiser | None"] = relationship("Fundraiser", back_populates="expenses")
    event: Mapped["Event | None"] = relationship("Event", back_populates="expenses")
