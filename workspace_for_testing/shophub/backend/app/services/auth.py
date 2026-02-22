"""
Authentication service - Handles user registration and login business logic.
"""
from datetime import timedelta
from sqlalchemy.orm import Session
from fastapi import HTTPException, status

from app.core.security import verify_password, get_password_hash, create_access_token
from app.core.config import settings
from app.core.constants import UserRole, ErrorMessage
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, TokenResponse, UserResponse


class AuthService:
    """Service for authentication operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def register(self, user_data: UserCreate) -> TokenResponse:
        """
        Register a new user.
        
        Args:
            user_data: User registration data
            
        Returns:
            TokenResponse with access token and user info
            
        Raises:
            HTTPException: If user already exists
        """
        # Check if user exists
        if self._user_exists(user_data.email):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=ErrorMessage.USER_ALREADY_EXISTS
            )
        
        # Create user
        user = self._create_user(user_data)
        
        # Generate token
        access_token = self._create_access_token(user.id)
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )
    
    def login(self, credentials: UserLogin) -> TokenResponse:
        """
        Authenticate user and return token.
        
        Args:
            credentials: User login credentials
            
        Returns:
            TokenResponse with access token and user info
            
        Raises:
            HTTPException: If credentials are invalid
        """
        # Find user
        user = self.db.query(User).filter(User.email == credentials.email).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ErrorMessage.INVALID_CREDENTIALS,
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Verify password
        if not verify_password(credentials.password, user.password):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=ErrorMessage.INVALID_CREDENTIALS,
                headers={"WWW-Authenticate": "Bearer"},
            )
        
        # Generate token
        access_token = self._create_access_token(user.id)
        
        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            user=UserResponse.model_validate(user)
        )
    
    def _user_exists(self, email: str) -> bool:
        """Check if user with email exists."""
        return self.db.query(User).filter(User.email == email).first() is not None
    
    def _create_user(self, user_data: UserCreate) -> User:
        """Create new user in database."""
        hashed_password = get_password_hash(user_data.password)
        new_user = User(
            email=user_data.email,
            password=hashed_password,
            name=user_data.name,
            role=UserRole.CUSTOMER
        )
        
        self.db.add(new_user)
        self.db.commit()
        self.db.refresh(new_user)
        
        return new_user
    
    def _create_access_token(self, user_id: str) -> str:
        """Create JWT access token for user."""
        access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
        return create_access_token(
            data={"sub": user_id},
            expires_delta=access_token_expires
        )
