"""
API v1 router - Combines all endpoint routers.
"""
from fastapi import APIRouter
from app.api.v1.endpoints import auth, products, orders

api_router = APIRouter()

# Include all endpoint routers
api_router.include_router(auth.router, prefix="/auth", tags=["Authentication"])
api_router.include_router(products.router, prefix="/products", tags=["Products"])
api_router.include_router(orders.router, prefix="/orders", tags=["Orders"])
