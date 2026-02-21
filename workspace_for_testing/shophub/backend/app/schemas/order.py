"""
Order Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import List, Optional
from app.schemas.product import ProductResponse


class OrderItemBase(BaseModel):
    """Base order item schema."""
    product_id: str
    quantity: int = Field(..., gt=0, description="Quantity must be greater than 0")
    price: float = Field(..., gt=0, description="Price must be greater than 0")


class OrderItemCreate(OrderItemBase):
    """Schema for creating an order item."""
    pass


class OrderItemResponse(OrderItemBase):
    """Schema for order item response."""
    id: str
    order_id: str
    created_at: datetime
    product: ProductResponse
    
    model_config = {"from_attributes": True}


class OrderBase(BaseModel):
    """Base order schema."""
    total: float = Field(..., gt=0, description="Total must be greater than 0")


class OrderCreate(BaseModel):
    """Schema for creating an order."""
    items: List[OrderItemCreate] = Field(..., min_length=1, description="Order must have at least one item")
    total: float = Field(..., gt=0)


class OrderUpdate(BaseModel):
    """Schema for updating an order."""
    status: Optional[str] = Field(None, pattern="^(pending|processing|shipped|delivered|cancelled)$")


class OrderResponse(OrderBase):
    """Schema for order response."""
    id: str
    user_id: str
    status: str
    created_at: datetime
    updated_at: datetime
    items: List[OrderItemResponse]
    
    model_config = {"from_attributes": True}
