"""
Product endpoints - CRUD operations for products.
"""
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from app.core.database import get_db
from app.api.deps import get_current_admin_user
from app.models.product import Product
from app.models.user import User
from app.schemas.product import ProductCreate, ProductUpdate, ProductResponse
from app.services.product import ProductService # Import ProductService

router = APIRouter()

# Dependency to inject ProductService
def get_product_service(db: Session = Depends(get_db)) -> ProductService:
    return ProductService(db)

# Helper function to get product or raise 404
def get_product_or_404_service(product_id: str, product_service: ProductService = Depends(get_product_service)) -> Product:
    product = product_service.get_product_by_id(product_id)
    if not product:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Product not found")
    return product

@router.get("/", response_model=List[ProductResponse])
def get_products(
    category: Optional[str] = Query(None, description="Filter by category (or 'all')"),
    featured: Optional[bool] = Query(None, description="Filter by featured status"),
    search: Optional[str] = Query(None, description="Search in name and description"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=100),
    product_service: ProductService = Depends(get_product_service) # Inject service
):
    """
    Get all products with optional filtering.
    
    - **category**: Filter by category (use 'all' for no filter)
    - **featured**: Filter by featured status
    - **search**: Search in product name and description
    - **skip**: Number of products to skip (pagination)
    - **limit**: Maximum number of products to return (max 100)
    """
    products = product_service.get_products(
        category=category,
        featured=featured,
        search=search,
        skip=skip,
        limit=limit
    )
    
    return [ProductResponse.model_validate(p) for p in products]


@router.get("/{product_id}", response_model=ProductResponse)
def get_product(product: Product = Depends(get_product_or_404_service)): # Use new dependency
    """
    Get a specific product by ID.
    
    - **product_id**: Product UUID
    """
    return ProductResponse.model_validate(product)


@router.post("/", response_model=ProductResponse, status_code=status.HTTP_201_CREATED)
def create_product(
    product_data: ProductCreate,
    product_service: ProductService = Depends(get_product_service), # Inject service
    current_user: User = Depends(get_current_admin_user)
):
    """
    Create a new product (Admin only).
    
    Requires authentication with admin role.
    """
    
    new_product = product_service.create_product(product_data) # Call service method
    
    return ProductResponse.model_validate(new_product)


@router.patch("/{product_id}", response_model=ProductResponse)
def update_product(
    product_data: ProductUpdate,
    product: Product = Depends(get_product_or_404_service), # Use new dependency
    product_service: ProductService = Depends(get_product_service), # Inject service
    current_user: User = Depends(get_current_admin_user)
):
    """
    Update a product (Admin only).
    
    - **product_id**: Product UUID
    
    Requires authentication with admin role.
    """
    
    updated_product = product_service.update_product(product, product_data) # Call service method
    
    return ProductResponse.model_validate(updated_product)


@router.delete("/{product_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_product(
    product: Product = Depends(get_product_or_404_service), # Use new dependency
    product_service: ProductService = Depends(get_product_service), # Inject service
    current_user: User = Depends(get_current_admin_user)
):
    """
    Delete a product (Admin only).
    
    - **product_id**: Product UUID
    
    Requires authentication with admin role.
    """
    
    product_service.delete_product(product) # Call service method
    
    return None
