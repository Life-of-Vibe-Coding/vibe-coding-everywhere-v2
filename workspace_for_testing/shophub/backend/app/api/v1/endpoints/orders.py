from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.order import OrderCreate, OrderUpdate, OrderResponse
from app.services.order import OrderService # Import OrderService

router = APIRouter()

# Dependency to inject OrderService
def get_order_service(db: Session = Depends(get_db)) -> OrderService:
    return OrderService(db)

# Helper function to get an order or raise 404/403
def get_order_or_404_or_403(
    order_id: str,
    current_user: User = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service)
) -> OrderResponse:
    order = order_service.get_order_with_auth(order_id, current_user)
    return order


@router.post("/", response_model=OrderResponse, status_code=status.HTTP_201_CREATED)
def create_order(
    order_data: OrderCreate,
    current_user: User = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service)
):
    """
    Create a new order for the authenticated user.
    
    - **items**: List of order items with product_id, quantity, and price
    - **total**: Total order amount
    
    Requires authentication.
    """
    new_order = order_service.create_order(order_data, current_user)
    return OrderResponse.model_validate(new_order)


@router.get("/", response_model=List[OrderResponse])
def get_user_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service)
):
    """
    Get all orders for the authenticated user.
    
    - **skip**: Number of orders to skip (pagination)
    - **limit**: Maximum number of orders to return (max 100)
    
    Requires authentication.
    """
    orders = order_service.get_user_orders(current_user, skip, limit)
    return [OrderResponse.model_validate(o) for o in orders]


@router.get("/{order_id}", response_model=OrderResponse)
def get_order(
    order: OrderResponse = Depends(get_order_or_404_or_403)
):
    """
    Get a specific order by ID.
    
    - **order_id**: Order UUID
    
    Users can only access their own orders unless they're admin.
    """
    return order


@router.patch("/{order_id}", response_model=OrderResponse)
def update_order(
    order_id: str,
    order_data: OrderUpdate,
    current_user: User = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service)
):
    """
    Update an order status (Admin only).
    
    - **order_id**: Order UUID
    - **status**: New order status (pending, processing, shipped, delivered, cancelled)
    
    Requires authentication with admin role.
    """
    updated_order = order_service.update_order_status(order_id, order_data, current_user)
    return OrderResponse.model_validate(updated_order)


@router.get("/admin/all", response_model=List[OrderResponse])
def get_all_orders(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    status: str = Query(None, description="Filter by status"),
    current_user: User = Depends(get_current_user),
    order_service: OrderService = Depends(get_order_service)
):
    """
    Get all orders (Admin only).
    
    - **skip**: Number of orders to skip (pagination)
    - **limit**: Maximum number of orders to return (max 100)
    - **status**: Filter by order status
    
    Requires authentication with admin role.
    """
    orders = order_service.get_all_orders(current_user, skip, limit, status)
    return [OrderResponse.model_validate(o) for o in orders]
