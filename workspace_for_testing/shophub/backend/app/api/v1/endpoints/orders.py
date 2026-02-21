"""
Order endpoints - Create and manage orders.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import User
from app.schemas.order import OrderCreate, OrderUpdate, OrderResponse

router = APIRouter()


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    order_data: OrderCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new order for the authenticated user.
    
    - **items**: List of order items with product_id, quantity, and price
    - **total**: Total order amount
    
    Requires authentication.
    """
    # Validate that all products exist
    product_ids = [item.product_id for item in order_data.items]
    products = db.query(Product).filter(Product.id.in_(product_ids)).all()
    
    if len(products) != len(product_ids):
        found_ids = {p.id for p in products}
        missing_ids = set(product_ids) - found_ids
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Products not found: {', '.join(missing_ids)}"
        )
    
    # Create order
    new_order = Order(
        user_id=current_user.id,
        total=order_data.total,
        status="pending"
    )
    db.add(new_order)
    db.flush()  # Get order ID without committing
    
    # Create order items
    for item_data in order_data.items:
        order_item = OrderItem(
            order_id=new_order.id,
            product_id=item_data.product_id,
            quantity=item_data.quantity,
            price=item_data.price
        )
        db.add(order_item)
    
    db.commit()
    db.refresh(new_order)
    
    return OrderResponse.model_validate(new_order)


@router.get("/", response_model=List[OrderResponse])
def get_user_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all orders for the authenticated user.
    
    - **skip**: Number of orders to skip (pagination)
    - **limit**: Maximum number of orders to return (max 100)
    
    Requires authentication.
    """
    orders = db.query(Order).filter(
        Order.user_id == current_user.id
    ).order_by(
        Order.created_at.desc()
    ).offset(skip).limit(limit).all()
    
    return [OrderResponse.model_validate(o) for o in orders]


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific order by ID.
    
    - **order_id**: Order UUID
    
    Users can only access their own orders unless they're admin.
    """
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found"
        )
    
    # Check authorization (user owns order or is admin)
    if order.user_id != current_user.id and current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to access this order"
        )
    
    return OrderResponse.model_validate(order)


@router.patch("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: str,
    order_data: OrderUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update an order status (Admin only).
    
    - **order_id**: Order UUID
    - **status**: New order status (pending, processing, shipped, delivered, cancelled)
    
    Requires authentication with admin role.
    """
    # Check if user is admin
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update order status"
        )
    
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Order with id {order_id} not found"
        )
    
    # Update status
    if order_data.status:
        order.status = order_data.status
    
    db.commit()
    db.refresh(order)
    
    return OrderResponse.model_validate(order)


@router.get("/admin/all", response_model=List[OrderResponse])
def get_all_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: str = Query(None, description="Filter by status"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get all orders (Admin only).
    
    - **skip**: Number of orders to skip (pagination)
    - **limit**: Maximum number of orders to return (max 100)
    - **status**: Filter by order status
    
    Requires authentication with admin role.
    """
    # Check if user is admin
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view all orders"
        )
    
    query = db.query(Order)
    
    if status:
        query = query.filter(Order.status == status)
    
    orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
    
    return [OrderResponse.model_validate(o) for o in orders]
