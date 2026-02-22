"""
Product endpoints - CRUD operations for products.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_admin_user, get_product_or_404
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse

router = APIRouter()


@router.get("/", response_model=List[ProductResponse])
def get_products(
    category: Optional[str] = Query(None, description="Filter by category (or 'all')"),
    featured: Optional[bool] = Query(None, description="Filter by featured status"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """
    Get all products with optional filtering.
    
    - **category**: Filter by category (use 'all' for no filter)
    - **featured**: Filter by featured status
    - **search**: Search in product name and description
    - **skip**: Number of products to skip (pagination)
    - **limit**: Maximum number of products to return (max 100)
    """
    query = db.query(Product)
    
    # Apply filters
    if category and category != "all":
        query = query.filter(Product.category == category)
    
    if featured is not None:
        query = query.filter(Product.featured == featured)
    
    if search:
        search_filter = f"%{search}%"
        query = query.filter(
            (Product.name.ilike(search_filter)) | 
            (Product.description.ilike(search_filter))
        )
    
    # Order and paginate
    products = query.order_by(Product.created_at.desc()).offset(skip).limit(limit).all()
    
    return [ProductResponse.model_validate(p) for p in products]


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product: Product = Depends(get_product_or_404)):
    """
    Get a specific product by ID.
    
    - **product_id**: Product UUID
    """
    return ProductResponse.model_validate(product)


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_data: ProductCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Create a new product (Admin only).
    
    Requires authentication with admin role.
    """
    
    new_product = Product(**product_data.model_dump())
    db.add(new_product)
    db.commit()
    db.refresh(new_product)
    
    return ProductResponse.model_validate(new_product)


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_data: ProductUpdate,
    product: Product = Depends(get_product_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Update a product (Admin only).
    
    - **product_id**: Product UUID
    
    Requires authentication with admin role.
    """
    
    # Update only provided fields
    update_data = product_data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(product, field, value)
    
    db.add(product)
    db.commit()
    db.refresh(product)
    
    return ProductResponse.model_validate(product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product: Product = Depends(get_product_or_404),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_admin_user)
):
    """
    Delete a product (Admin only).
    
    - **product_id**: Product UUID
    
    Requires authentication with admin role.
    """
    
    db.delete(product)
    db.commit()
    
    return None
