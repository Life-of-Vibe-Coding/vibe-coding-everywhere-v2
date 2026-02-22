"""
Authentication endpoints - Registration and login.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, TokenResponse, UserResponse
from app.services.auth import AuthService # Import AuthService

router = APIRouter()

# Dependency to inject AuthService
def get_auth_service(db: Session = Depends(get_db)) -> AuthService:
    return AuthService(db)


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register(user_data: UserCreate, auth_service: AuthService = Depends(get_auth_service)): # Inject service
    """
    Register a new user.
    
    - **email**: Valid email address
    - **password**: At least 6 characters
    - **name**: User's display name (optional)
    
    Returns JWT token and user information.
    """
    return auth_service.register_user(user_data)


@router.post("/login", response_model=TokenResponse)
def login(credentials: UserLogin, auth_service: AuthService = Depends(get_auth_service)): # Inject service
    """
    Login with email and password.
    
    - **email**: Registered email address
    - **password**: User's password
    
    Returns JWT token and user information.
    """
    return auth_service.authenticate_user(credentials)


@router.get("/me", response_model=UserResponse)
def get_current_user_info(current_user: User = Depends(get_current_user)):
    """
    Get current authenticated user information.
    
    Requires valid JWT token in Authorization header.
    """
    return UserResponse.model_validate(current_user)
