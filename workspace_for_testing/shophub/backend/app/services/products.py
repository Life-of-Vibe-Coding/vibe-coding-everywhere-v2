"""
Product service layer - handles business logic for products.
"""
from sqlalchemy.orm import Session
from typing import List, Optional

from app.models.product import Product
from app.schemas.product import ProductCreate, ProductUpdate

class ProductService:
    def __init__(self, db: Session):
        self.db = db

    def get_products(
        self,
        category: Optional[str] = None,
        featured: Optional[bool] = None,
        search: Optional[str] = None,
        skip: int = 0,
        limit: int = 100
    ) -> List[Product]:
        query = self.db.query(Product)

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
        
        return query.order_by(Product.created_at.desc()).offset(skip).limit(limit).all()

    def get_product(self, product_id: str) -> Optional[Product]:
        return self.db.query(Product).filter(Product.id == product_id).first()

    def create_product(self, product_data: ProductCreate) -> Product:
        new_product = Product(**product_data.model_dump())
        self.db.add(new_product)
        self.db.commit()
        self.db.refresh(new_product)
        return new_product

    def update_product(self, product: Product, product_data: ProductUpdate) -> Product:
        update_data = product_data.model_dump(exclude_unset=True)
        for field, value in update_data.items():
            setattr(product, field, value)
        
        self.db.commit()
        self.db.refresh(product)
        return product

    def delete_product(self, product: Product):
        self.db.delete(product)
        self.db.commit()
