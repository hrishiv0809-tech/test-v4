import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.core.deps import get_db, require_roles
from app.models.user import User, UserRole
from app.models.subscriber import MailingListSubscriber
from app.schemas.newsletter import NewsletterSubscribeRequest, SubscriberResponse

router = APIRouter(prefix="/newsletter", tags=["Newsletter"])

@router.post("/subscribe")
def subscribe(req: NewsletterSubscribeRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()
    existing = db.query(MailingListSubscriber).filter(MailingListSubscriber.email == email).first()
    if existing:
        if not existing.subscribed:
            existing.subscribed = True
            db.commit()
        return {"message": "Subscribed successfully!"}

    sub = MailingListSubscriber(
        email=email,
        name=req.name,
        subscribed=True,
        unsubscribe_token=uuid.uuid4().hex
    )
    db.add(sub)
    db.commit()
    return {"message": "Thank you for subscribing to Skyline updates!"}

@router.get("/unsubscribe/{token}")
def unsubscribe(token: str, db: Session = Depends(get_db)):
    sub = db.query(MailingListSubscriber).filter(MailingListSubscriber.unsubscribe_token == token).first()
    if not sub:
        raise HTTPException(status_code=404, detail="Invalid unsubscribe link")
    sub.subscribed = False
    db.commit()
    return {"message": "You have been successfully unsubscribed from the mailing list."}

@router.get("/subscribers", response_model=List[SubscriberResponse])
def get_subscribers(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    return db.query(MailingListSubscriber).all()
