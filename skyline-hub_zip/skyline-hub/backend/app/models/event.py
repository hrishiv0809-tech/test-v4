from datetime import datetime
from decimal import Decimal
import enum
from sqlalchemy import String, DateTime, Text, Integer, Numeric, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class EventStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    COMPLETED = "COMPLETED"
    CANCELLED = "CANCELLED"

class Event(Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(200), nullable=True)
    start_date: Mapped[datetime] = mapped_column(DateTime, nullable=False, index=True)
    end_date: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    capacity: Mapped[int] = mapped_column(Integer, default=100, nullable=False)
    member_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    non_member_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=Decimal("0.00"), nullable=False)
    status: Mapped[EventStatus] = mapped_column(Enum(EventStatus), default=EventStatus.PUBLISHED, nullable=False, index=True)

    tickets: Mapped[list["Ticket"]] = relationship("Ticket", back_populates="event", cascade="all, delete-orphan")
    expenses: Mapped[list["ExpenseClaim"]] = relationship("ExpenseClaim", back_populates="event")
