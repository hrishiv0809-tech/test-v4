from datetime import datetime, timezone
import enum
from sqlalchemy import String, DateTime, Text, Boolean, Integer, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.db.base import Base

class AnnouncementCategory(str, enum.Enum):
    MEETING = "MEETING"
    DEADLINE = "DEADLINE"
    CHANGE_OF_PLAN = "CHANGE_OF_PLAN"
    GENERAL = "GENERAL"

class Announcement(Base):
    __tablename__ = "announcements"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str] = mapped_column(Text, nullable=False)
    category: Mapped[AnnouncementCategory] = mapped_column(Enum(AnnouncementCategory), default=AnnouncementCategory.GENERAL, nullable=False, index=True)
    author_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    published_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc), nullable=False, index=True)
    email_sent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    recipient_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)

    author: Mapped["User | None"] = relationship("User", back_populates="announcements")
