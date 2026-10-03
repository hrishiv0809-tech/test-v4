from datetime import datetime, timezone
from decimal import Decimal
import enum
from sqlalchemy import String, DateTime, Boolean, Numeric, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class TicketStatus(str, enum.Enum):
    VALID = "VALID"
    CHECKED_IN = "CHECKED_IN"
    CANCELLED = "CANCELLED"

class Ticket(Base):
    __tablename__ = "tickets"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    buyer_name: Mapped[str] = mapped_column(String(100), nullable=False)
    buyer_email: Mapped[str] = mapped_column(String(150), nullable=False, index=True)
    price_paid: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    is_member_price: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    ticket_code: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    status: Mapped[TicketStatus] = mapped_column(Enum(TicketStatus), default=TicketStatus.VALID, nullable=False, index=True)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    checked_in_by_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    event: Mapped["Event"] = relationship("Event", back_populates="tickets")
    user: Mapped["User | None"] = relationship("User", back_populates="tickets", foreign_keys=[user_id])
    checked_in_by: Mapped["User | None"] = relationship("User", foreign_keys=[checked_in_by_id])
