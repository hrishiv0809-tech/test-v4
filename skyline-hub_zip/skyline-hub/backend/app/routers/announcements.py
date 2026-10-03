from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, status
from sqlalchemy.orm import Session, joinedload
from app.core.deps import get_db, require_roles
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.models.membership import Membership, MembershipStatus
from app.models.subscriber import MailingListSubscriber
from app.models.announcement import Announcement, AnnouncementCategory
from app.schemas.announcement import AnnouncementResponse, AnnouncementCreate, AnnouncementUpdate
from app.services.email_service import email_service

router = APIRouter(prefix="/announcements", tags=["Announcements"])

@router.get("", response_model=List[AnnouncementResponse])
def list_announcements(
    category: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Announcement).options(joinedload(Announcement.author))
    if category:
        query = query.filter(Announcement.category == category)
    return query.order_by(Announcement.published_at.desc()).all()

@router.post("", response_model=AnnouncementResponse)
def create_announcement(
    req: AnnouncementCreate,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_roles(UserRole.ADMIN))
):
    announcement = Announcement(
        title=req.title,
        body=req.body,
        category=req.category,
        author_id=current_user.id,
        email_sent=req.send_email,
        recipient_count=0
    )
    db.add(announcement)
    db.flush()

    if req.send_email:
        active_member_emails = [
            email for (email,) in db.query(User.email).join(Membership, Membership.user_id == User.id).filter(
                Membership.status == MembershipStatus.ACTIVE
            ).all()
        ]
        subscriber_emails = [
            email for (email,) in db.query(MailingListSubscriber.email).filter(
                MailingListSubscriber.subscribed == True
            ).all()
        ]
        all_emails = list(set([e.strip().lower() for e in (active_member_emails + subscriber_emails) if e]))
        announcement.recipient_count = len(all_emails)

        background_tasks.add_task(
            email_service.send_bulk_announcement,
            SessionLocal,
            all_emails,
            f"[Skyline] {announcement.title}",
            announcement.body,
            announcement.id
        )

    db.commit()
    db.refresh(announcement)
    return announcement

@router.get("/{id}", response_model=AnnouncementResponse)
def get_announcement(id: int, db: Session = Depends(get_db)):
    ann = db.query(Announcement).filter(Announcement.id == id).options(joinedload(Announcement.author)).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    return ann

@router.patch("/{id}", response_model=AnnouncementResponse)
def update_announcement(
    id: int,
    req: AnnouncementUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    ann = db.query(Announcement).filter(Announcement.id == id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    
    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(ann, k, v)

    db.commit()
    db.refresh(ann)
    return ann

@router.delete("/{id}")
def delete_announcement(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    ann = db.query(Announcement).filter(Announcement.id == id).first()
    if not ann:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.delete(ann)
    db.commit()
    return {"message": "Announcement deleted successfully"}
