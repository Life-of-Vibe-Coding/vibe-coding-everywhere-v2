"""
User model - Represents application users (customers and admins).
"""
from sqlalchemy import Column, String, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


def generate_uuid():
    """Generate UUID for primary keys."""
    return str(uuid.uuid4())


class User(Base):
    """User model for authentication and order tracking."""
    
    __tablename__ = "users"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    email = Column(String, unique=True, nullable=False, index=True)
    password = Column(String, nullable=False)  # Hashed password
    name = Column(String, nullable=True)
    role = Column(String, nullable=False, default="customer")  # customer, admin
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    orders = relationship("Order", back_populates="user", cascade="all, delete-orphan")
    
    def __repr__(self):
        return f"<User(id={self.id}, email={self.email}, role={self.role})>"
