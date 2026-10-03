from datetime import date
from pydantic import BaseModel
from app.models.task import TaskStatus, TaskPriority
from app.schemas.user import UserResponse

class TaskBase(BaseModel):
    title: str
    description: str | None = None
    assignee_id: int | None = None
    due_date: date | None = None
    status: TaskStatus = TaskStatus.TODO
    priority: TaskPriority = TaskPriority.MEDIUM
    position: int = 0

class TaskCreate(TaskBase):
    fundraiser_id: int

class TaskUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    assignee_id: int | None = None
    due_date: date | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    position: int | None = None

class TaskStatusUpdate(BaseModel):
    status: TaskStatus
    position: int | None = None

class TaskResponse(TaskBase):
    id: int
    fundraiser_id: int
    assignee: UserResponse | None = None
    is_overdue: bool = False

    class Config:
        from_attributes = True
