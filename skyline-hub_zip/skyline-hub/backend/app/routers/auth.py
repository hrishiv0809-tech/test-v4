from datetime import timedelta
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.db.session import SessionLocal
from app.core.deps import get_db, get_current_user, require_roles
from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.models.user import User, UserRole
from app.models.membership import Membership, MembershipStatus
from app.models.membership_plan import MembershipPlan
from app.schemas.auth import LoginRequest, RegisterRequest, Token
from app.schemas.user import UserResponse
import uuid

router = APIRouter(prefix="/auth", tags=["Authentication"])

@router.post("/register", response_model=Token)
def register(req: RegisterRequest, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == req.email).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="An account with this email address already exists."
        )

    user = User(
        name=req.name,
        email=req.email,
        password_hash=get_password_hash(req.password),
        phone=req.phone,
        student_id=req.student_id,
        role=UserRole.MEMBER
    )
    db.add(user)
    db.flush()

    if req.plan_id:
        plan = db.query(MembershipPlan).filter(MembershipPlan.id == req.plan_id).first()
        if plan:
            member_code = f"SKY-{uuid.uuid4().hex[:8].upper()}"
            membership = Membership(
                user_id=user.id,
                plan_id=plan.id,
                status=MembershipStatus.PENDING_PAYMENT,
                dues_paid=False,
                amount_paid=0.0,
                member_code=member_code
            )
            db.add(membership)

    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/login", response_model=Token)
def login(req: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/users", response_model=List[UserResponse])
def list_users(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER, UserRole.VOLUNTEER))
):
    return db.query(User).order_by(User.name.asc()).all()
