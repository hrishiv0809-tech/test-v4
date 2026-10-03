from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, joinedload
from app.core.deps import get_db, get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.task import FundraiserTask, TaskStatus
from app.schemas.task import TaskResponse, TaskCreate, TaskUpdate

router = APIRouter(prefix="/tasks", tags=["Fundraiser Tasks"])

def _to_task_response(t: FundraiserTask) -> TaskResponse:
    today = date.today()
    tr = TaskResponse.model_validate(t)
    tr.is_overdue = bool(t.due_date and t.due_date < today and t.status != TaskStatus.DONE)
    return tr

@router.get("/my-tasks", response_model=List[TaskResponse])
def get_my_tasks(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    tasks = db.query(FundraiserTask).filter(
        FundraiserTask.assignee_id == current_user.id
    ).options(joinedload(FundraiserTask.assignee)).order_by(FundraiserTask.due_date.asc()).all()
    return [_to_task_response(t) for t in tasks]

@router.post("", response_model=TaskResponse)
def create_task(
    req: TaskCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER, UserRole.VOLUNTEER))
):
    task = FundraiserTask(**req.model_dump())
    db.add(task)
    db.commit()
    db.refresh(task)
    return _to_task_response(task)

@router.patch("/{id}", response_model=TaskResponse)
def update_task_status_or_position(
    id: int,
    req: TaskUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER, UserRole.VOLUNTEER))
):
    task = db.query(FundraiserTask).filter(FundraiserTask.id == id).options(joinedload(FundraiserTask.assignee)).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")

    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(task, k, v)

    db.commit()
    db.refresh(task)
    return _to_task_response(task)

@router.delete("/{id}")
def delete_task(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    task = db.query(FundraiserTask).filter(FundraiserTask.id == id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    db.delete(task)
    db.commit()
    return {"message": "Task deleted successfully"}
