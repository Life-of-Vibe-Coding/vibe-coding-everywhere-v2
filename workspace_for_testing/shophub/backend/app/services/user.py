"""
User service - Handles user-related business logic.
"""
from sqlalchemy.orm import Session
from fastapi import HTTPException, status
from typing import Optional

from app.models.user import User
from app.core.constants import ErrorMessage


class UserService:
    """Service for user operations."""
    
    def __init__(self, db: Session):
        self.db = db
    
    def get_user_by_id(self, user_id: str) -> User:
        """
        Get user by ID.
        
        Args:
            user_id: User's UUID
            
        Returns:
            User object
            
        Raises:
            HTTPException: If user not found
        """
        user = self.db.query(User).filter(User.id == user_id).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=ErrorMessage.USER_NOT_FOUND
            )
        return user
    
    def get_user_by_email(self, email: str) -> Optional[User]:
        """
        Get user by email.
        
        Args:
            email: User's email address
            
        Returns:
            User object or None if not found
        """
        return self.db.query(User).filter(User.email == email).first()
    
    def user_exists(self, email: str) -> bool:
        """
        Check if user with email exists.
        
        Args:
            email: Email to check
            
        Returns:
            True if user exists, False otherwise
        """
        return self.get_user_by_email(email) is not None
