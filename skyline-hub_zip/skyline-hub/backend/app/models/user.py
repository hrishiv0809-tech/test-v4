from datetime import datetime, timezone
import enum
from sqlalchemy import String, DateTime, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class UserRole(str, enum.Enum):
    ADMIN = "ADMIN"
    TREASURER = "TREASURER"
    VOLUNTEER = "VOLUNTEER"
    MEMBER = "MEMBER"

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(150), unique=True, index=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str | None] = mapped_column(String(20), nullable=True)
    student_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    role: Mapped[UserRole] = mapped_column(Enum(UserRole), default=UserRole.MEMBER, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False)

    # Relationships
    membership: Mapped[list["Membership"]] = relationship("Membership", back_populates="user", cascade="all, delete-orphan")
    tickets: Mapped[list["Ticket"]] = relationship("Ticket", back_populates="user", foreign_keys="[Ticket.user_id]")
    orders: Mapped[list["Order"]] = relationship("Order", back_populates="user")
    assigned_tasks: Mapped[list["FundraiserTask"]] = relationship("FundraiserTask", back_populates="assignee")
    expense_claims: Mapped[list["ExpenseClaim"]] = relationship("ExpenseClaim", back_populates="submitted_by", foreign_keys="[ExpenseClaim.submitted_by_id]")
    announcements: Mapped[list["Announcement"]] = relationship("Announcement", back_populates="author")
