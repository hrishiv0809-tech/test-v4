from decimal import Decimal
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session, joinedload
from app.core.deps import get_db, get_current_user, require_roles
from app.models.user import User, UserRole
from app.models.product import Product, ProductVariant
from app.models.order import Order, OrderItem, OrderStatus
from app.models.membership import Membership, MembershipStatus
from app.models.transaction import TransactionType, TransactionSource
from app.schemas.order import OrderCreateRequest, OrderResponse
from app.services.transaction_service import transaction_service

router = APIRouter(prefix="/orders", tags=["Orders"])

@router.post("", response_model=OrderResponse)
def create_and_pay_order(
    req: OrderCreateRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    if not req.items:
        raise HTTPException(status_code=400, detail="Cart is empty")

    active_mem = db.query(Membership).filter(
        Membership.user_id == current_user.id,
        Membership.status == MembershipStatus.ACTIVE
    ).options(joinedload(Membership.plan)).first()

    discount_percent = Decimal(0)
    if active_mem and active_mem.plan:
        discount_percent = Decimal(active_mem.plan.merch_discount_percent)

    subtotal = Decimal("0.00")
    order_items_to_create = []

    for item in req.items:
        variant = db.query(ProductVariant).filter(
            ProductVariant.id == item.variant_id
        ).options(joinedload(ProductVariant.product)).with_for_update().first()

        if not variant:
            raise HTTPException(status_code=404, detail=f"Product variant {item.variant_id} not found")

        if variant.stock < item.quantity:
            raise HTTPException(
                status_code=400,
                detail=f"Insufficient stock for {variant.product.name} (Size: {variant.size.value}). Available: {variant.stock}"
            )

        variant.stock -= item.quantity
        item_unit_price = variant.product.base_price
        subtotal += item_unit_price * Decimal(item.quantity)

        order_items_to_create.append({
            "variant_id": variant.id,
            "quantity": item.quantity,
            "unit_price": item_unit_price
        })

    discount_amount = round(subtotal * (discount_percent / Decimal(100)), 2)
    total_amount = subtotal - discount_amount

    order = Order(
        user_id=current_user.id,
        status=OrderStatus.PAID,
        subtotal=subtotal,
        discount=discount_amount,
        total=total_amount
    )
    db.add(order)
    db.flush()

    for item_data in order_items_to_create:
        oi = OrderItem(
            order_id=order.id,
            variant_id=item_data["variant_id"],
            quantity=item_data["quantity"],
            unit_price=item_data["unit_price"]
        )
        db.add(oi)

    transaction_service.record_transaction(
        db=db,
        type=TransactionType.INCOME,
        source=TransactionSource.MERCH,
        amount=total_amount,
        description=f"Merch Order #{order.id} paid by {current_user.name}",
        reference_type="ORDER",
        reference_id=order.id,
        created_by_id=current_user.id
    )

    db.commit()
    db.refresh(order)
    return order

@router.get("/my-orders", response_model=List[OrderResponse])
def get_my_orders(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).options(
        joinedload(Order.items).joinedload(OrderItem.variant).joinedload(ProductVariant.product)
    ).order_by(Order.id.desc()).all()
    return orders

@router.get("", response_model=List[OrderResponse])
def list_all_orders(
    status_filter: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN, UserRole.TREASURER))
):
    query = db.query(Order).options(
        joinedload(Order.items).joinedload(OrderItem.variant).joinedload(ProductVariant.product)
    )
    if status_filter:
        query = query.filter(Order.status == status_filter)
    return query.order_by(Order.id.desc()).all()

@router.patch("/{id}/fulfill", response_model=OrderResponse)
def fulfill_order(
    id: int,
    db: Session = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN))
):
    order = db.query(Order).filter(Order.id == id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    order.status = OrderStatus.FULFILLED
    db.commit()
    db.refresh(order)
    return order
