"""
Product Pydantic schemas for request/response validation.
"""
from pydantic import BaseModel, Field
from datetime import datetime
from typing import Optional


class ProductBase(BaseModel):
    """Base product schema with common fields."""
    name: str = Field(..., min_length=1, max_length=200)
    description: str = Field(..., min_length=1)
    price: float = Field(..., gt=0, description="Price must be greater than 0")
    image: str = Field(..., min_length=1)
    category: str = Field(..., min_length=1)
    stock: int = Field(default=0, ge=0, description="Stock cannot be negative")
    featured: bool = Field(default=False)


class ProductCreate(ProductBase):
    """Schema for creating a new product."""
    pass


class ProductUpdate(BaseModel):
    """Schema for updating a product (all fields optional)."""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = Field(None, min_length=1)
    price: Optional[float] = Field(None, gt=0)
    image: Optional[str] = Field(None, min_length=1)
    category: Optional[str] = Field(None, min_length=1)
    stock: Optional[int] = Field(None, ge=0)
    featured: Optional[bool] = None


class ProductResponse(ProductBase):
    """Schema for product response."""
    id: str
    created_at: datetime
    updated_at: datetime
    
    model_config = {"from_attributes": True}
