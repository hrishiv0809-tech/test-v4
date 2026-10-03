from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from app.core.deps import get_db, get_optional_current_user, require_roles
from app.models.user import User, UserRole
from app.models.product import Product, ProductVariant, ProductSize
from app.models.order import OrderItem, Order, OrderStatus
from app.models.membership import Membership, MembershipStatus
from app.schemas.product import ProductResponse, ProductCreate, ProductUpdate, StockSummaryItem

router = APIRouter(prefix="/products", tags=["Products & Store"])

def _get_product_response(product: Product, current_user: Optional[User]) -> ProductResponse:
    resp = ProductResponse.model_validate(product)
    if current_user and current_user.membership:
        active_mem = next((m for m in current_user.membership if m.status == MembershipStatus.ACTIVE), None)
        if active_mem and active_mem.plan and active_mem.plan.merch_discount_percent > 0:
            discount_multiplier = Decimal(1) - (Decimal(active_mem.plan.merch_discount_percent) / Decimal(100))
            resp.member_price = round(product.base_price * discount_multiplier, 2)
    return resp

@router.get("", response_model=List[ProductResponse])
def list_products(
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    query = db.query(Product).options(joinedload(Product.variants))
    if not current_user or current_user.role != UserRole.ADMIN:
        query = query.filter(Product.active == True)
    products = query.all()
    return [_get_product_response(p, current_user) for p in products]

@router.post("", response_model=ProductResponse)
def create_product(
    req: ProductCreate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    product = Product(
        name=req.name,
        description=req.description,
        image_url=req.image_url,
        base_price=req.base_price,
        active=req.active
    )
    db.add(product)
    db.flush()

    for v in req.variants:
        variant = ProductVariant(
            product_id=product.id,
            size=v.size,
            stock=v.stock
        )
        db.add(variant)

    db.commit()
    db.refresh(product)
    return _get_product_response(product, None)

@router.get("/{id}", response_model=ProductResponse)
def get_product(
    id: int,
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_current_user)
):
    product = db.query(Product).filter(Product.id == id).options(joinedload(Product.variants)).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    return _get_product_response(product, current_user)

@router.patch("/{id}", response_model=ProductResponse)
def update_product(
    id: int,
    req: ProductUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    product = db.query(Product).filter(Product.id == id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    
    update_data = req.model_dump(exclude_unset=True)
    for k, v in update_data.items():
        setattr(product, k, v)
    
    db.commit()
    db.refresh(product)
    return _get_product_response(product, None)

@router.get("/admin/stock-summary", response_model=List[StockSummaryItem])
def get_stock_summary(
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    variants = db.query(ProductVariant).options(joinedload(ProductVariant.product)).all()
    
    summary = []
    for v in variants:
        ordered_qty = db.query(func.sum(OrderItem.quantity)).join(Order).filter(
            OrderItem.variant_id == v.id,
            Order.status.in_([OrderStatus.PAID, OrderStatus.FULFILLED])
        ).scalar() or 0

        summary.append(StockSummaryItem(
            product_id=v.product_id,
            product_name=v.product.name if v.product else "Unknown",
            size=v.size.value,
            remaining_stock=v.stock,
            ordered_quantity=ordered_qty
        ))
    return summary
