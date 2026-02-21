"""
Product model - Represents items available for purchase.
"""
from sqlalchemy import Column, String, Float, Integer, Boolean, DateTime
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
import uuid

from app.core.database import Base


def generate_uuid():
    """Generate UUID for primary keys."""
    return str(uuid.uuid4())


class Product(Base):
    """Product model for the e-commerce catalog."""
    
    __tablename__ = "products"
    
    id = Column(String, primary_key=True, default=generate_uuid)
    name = Column(String, nullable=False)
    description = Column(String, nullable=False)
    price = Column(Float, nullable=False)
    image = Column(String, nullable=False)
    category = Column(String, nullable=False, index=True)
    stock = Column(Integer, nullable=False, default=0)
    featured = Column(Boolean, nullable=False, default=False, index=True)
    
    # Timestamps
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
    
    # Relationships
    order_items = relationship("OrderItem", back_populates="product")
    
    def __repr__(self):
        return f"<Product(id={self.id}, name={self.name}, price={self.price})>"
