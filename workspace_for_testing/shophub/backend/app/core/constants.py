"""
Application constants - Roles, statuses, and error messages.
"""
from enum import Enum


class UserRole(str, Enum):
    """User role enumeration."""
    CUSTOMER = "customer"
    ADMIN = "admin"


class OrderStatus(str, Enum):
    """Order status enumeration."""
    PENDING = "pending"
    PROCESSING = "processing"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"


class ErrorMessage:
    """Centralized error messages."""
    # Authentication
    USER_ALREADY_EXISTS = "User with this email already exists"
    INVALID_CREDENTIALS = "Incorrect email or password"
    UNAUTHORIZED = "Could not validate credentials"
    USER_NOT_FOUND = "User not found"
    FORBIDDEN = "You don't have permission to perform this action"
    ADMIN_ONLY = "Only admins are allowed to perform this action"
    
    # Products
    PRODUCT_NOT_FOUND = "Product with id {product_id} not found"
    PRODUCTS_NOT_FOUND = "Products not found: {product_ids}"
    
    # Orders
    ORDER_NOT_FOUND = "Order with id {order_id} not found"
    ORDER_ACCESS_DENIED = "You don't have permission to access this order"
    ORDER_UPDATE_ADMIN_ONLY = "Only admins can update order status"
    ORDER_VIEW_ADMIN_ONLY = "Only admins can view all orders"


class SuccessMessage:
    """Centralized success messages."""
    USER_CREATED = "User registered successfully"
    LOGIN_SUCCESS = "Login successful"
    PRODUCT_CREATED = "Product created successfully"
    PRODUCT_UPDATED = "Product updated successfully"
    PRODUCT_DELETED = "Product deleted successfully"
    ORDER_CREATED = "Order created successfully"
    ORDER_UPDATED = "Order updated successfully"
