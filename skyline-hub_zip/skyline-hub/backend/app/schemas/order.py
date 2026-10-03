from datetime import datetime
from decimal import Decimal
from typing import List
from pydantic import BaseModel
from app.models.order import OrderStatus
from app.schemas.product import ProductVariantResponse

class OrderItemCreate(BaseModel):
    variant_id: int
    quantity: int

class OrderCreateRequest(BaseModel):
    items: List[OrderItemCreate]

class OrderItemResponse(BaseModel):
    id: int
    order_id: int
    variant_id: int
    quantity: int
    unit_price: Decimal
    variant: ProductVariantResponse | None = None

    class Config:
        from_attributes = True

class OrderResponse(BaseModel):
    id: int
    user_id: int
    status: OrderStatus
    subtotal: Decimal
    discount: Decimal
    total: Decimal
    created_at: datetime
    items: List[OrderItemResponse] = []

    class Config:
        from_attributes = True
