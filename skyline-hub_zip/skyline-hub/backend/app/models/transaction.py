from datetime import datetime, timezone
from decimal import Decimal
import enum
from sqlalchemy import String, DateTime, Numeric, Enum, Integer, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class TransactionType(str, enum.Enum):
    INCOME = "INCOME"
    EXPENSE = "EXPENSE"

class TransactionSource(str, enum.Enum):
    DUES = "DUES"
    TICKET = "TICKET"
    MERCH = "MERCH"
    FUNDRAISER = "FUNDRAISER"
    DONATION = "DONATION"
    REIMBURSEMENT = "REIMBURSEMENT"
    OTHER = "OTHER"

class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    type: Mapped[TransactionType] = mapped_column(Enum(TransactionType), nullable=False, index=True)
    source: Mapped[TransactionSource] = mapped_column(Enum(TransactionSource), nullable=False, index=True)
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    reference_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    reference_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    created_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    created_by: Mapped["User | None"] = relationship("User")
