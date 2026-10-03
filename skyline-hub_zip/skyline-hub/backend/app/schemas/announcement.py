from datetime import datetime
from pydantic import BaseModel
from app.models.announcement import AnnouncementCategory
from app.schemas.user import UserResponse

class AnnouncementBase(BaseModel):
    title: str
    body: str
    category: AnnouncementCategory = AnnouncementCategory.GENERAL

class AnnouncementCreate(AnnouncementBase):
    send_email: bool = False

class AnnouncementUpdate(BaseModel):
    title: str | None = None
    body: str | None = None
    category: AnnouncementCategory | None = None

class AnnouncementResponse(AnnouncementBase):
    id: int
    author_id: int | None = None
    published_at: datetime
    email_sent: bool
    recipient_count: int
    author: UserResponse | None = None

    class Config:
        from_attributes = True
