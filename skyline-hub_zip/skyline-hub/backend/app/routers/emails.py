from typing import Optional
from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from app.core.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.models.email_log import EmailLog
from pydantic import BaseModel
from datetime import datetime

class EmailLogResponse(BaseModel):
    id: int
    to_email: str
    subject: str
    body: str
    sent_at: datetime
    related_type: str | None = None
    related_id: int | None = None

    class Config:
        from_attributes = True

router = APIRouter(prefix="/emails", tags=["Email Logs"])

@router.get("", response_model=dict)
def list_email_logs(
    q: Optional[str] = Query(None, description="Search recipient email or subject"),
    related_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    limit: int = Query(25, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    query = db.query(EmailLog)
    if q:
        search = f"%{q}%"
        query = query.filter((EmailLog.to_email.ilike(search)) | (EmailLog.subject.ilike(search)))
    if related_type:
        query = query.filter(EmailLog.related_type == related_type)

    total = query.count()
    logs = query.order_by(EmailLog.sent_at.desc()).offset((page - 1) * limit).limit(limit).all()

    return {
        "items": [EmailLogResponse.model_validate(log) for log in logs],
        "total": total,
        "page": page,
        "limit": limit,
        "pages": (total + limit - 1) // limit
    }
