from datetime import date
from decimal import Decimal
import enum
from sqlalchemy import String, Date, Text, Numeric, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class FundraiserStatus(str, enum.Enum):
    PLANNING = "PLANNING"
    ACTIVE = "ACTIVE"
    COMPLETED = "COMPLETED"

class Fundraiser(Base):
    __tablename__ = "fundraisers"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    goal_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    raised_amount: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    event_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    status: Mapped[FundraiserStatus] = mapped_column(Enum(FundraiserStatus), default=FundraiserStatus.PLANNING, nullable=False, index=True)

    tasks: Mapped[list["FundraiserTask"]] = relationship("FundraiserTask", back_populates="fundraiser", cascade="all, delete-orphan")
    expenses: Mapped[list["ExpenseClaim"]] = relationship("ExpenseClaim", back_populates="fundraiser")
