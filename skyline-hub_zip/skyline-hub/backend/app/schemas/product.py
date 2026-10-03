from decimal import Decimal
from typing import List
from pydantic import BaseModel
from app.models.product import ProductSize

class ProductVariantBase(BaseModel):
    size: ProductSize
    stock: int = 0

class ProductVariantCreate(ProductVariantBase):
    pass

class ProductVariantResponse(ProductVariantBase):
    id: int
    product_id: int

    class Config:
        from_attributes = True

class ProductBase(BaseModel):
    name: str
    description: str | None = None
    image_url: str | None = None
    base_price: Decimal
    active: bool = True

class ProductCreate(ProductBase):
    variants: List[ProductVariantCreate] = []

class ProductUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    image_url: str | None = None
    base_price: Decimal | None = None
    active: bool | None = None

class ProductResponse(ProductBase):
    id: int
    variants: List[ProductVariantResponse] = []
    member_price: Decimal | None = None

    class Config:
        from_attributes = True

class StockSummaryItem(BaseModel):
    product_id: int
    product_name: str
    size: str
    remaining_stock: int
    ordered_quantity: int
