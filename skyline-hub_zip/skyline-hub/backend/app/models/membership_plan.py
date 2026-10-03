from decimal import Decimal
from sqlalchemy import String, Numeric, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class MembershipPlan(Base):
    __tablename__ = "membership_plans"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2), nullable=False)
    duration_months: Mapped[int] = mapped_column(Integer, default=12, nullable=False)
    ticket_discount_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    merch_discount_percent: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    benefits: Mapped[str | None] = mapped_column(Text, nullable=True)

    memberships: Mapped[list["Membership"]] = relationship("Membership", back_populates="plan")
