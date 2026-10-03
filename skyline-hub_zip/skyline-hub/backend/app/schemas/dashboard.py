from datetime import datetime
from decimal import Decimal
from typing import List
from pydantic import BaseModel

class RecentActivityItem(BaseModel):
    id: str
    type: str
    description: str
    timestamp: datetime
    user_name: str | None = None

class AdminDashboardResponse(BaseModel):
    active_members: int
    members_expiring_soon: int
    upcoming_events: int
    tickets_sold_this_week: int
    open_orders: int
    open_tasks: int
    pending_claims: int
    current_balance: Decimal
    recent_activity: List[RecentActivityItem] = []
