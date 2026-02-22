"""
Common dependencies for API endpoints.
"""
from fastapi import HTTPException, status, Depends
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.models.product import Product


def get_current_admin_user(current_user: User = Depends(get_current_user)):
    """
    Dependency to check if the current user is an admin.
    Raises HTTPException 403 if not an admin.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins are allowed to perform this action"
        )
    return current_user


def get_product_or_404(product_id: str, db: Session = Depends(get_db)) -> Product:
    """
    Dependency to fetch a product by ID or raise a 404 HTTPException.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Product with id {product_id} not found"
        )
    return product
