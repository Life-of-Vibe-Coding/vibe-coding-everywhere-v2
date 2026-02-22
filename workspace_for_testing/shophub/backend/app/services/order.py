from typing import List, Optional
from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.order import Order, OrderItem
from app.models.product import Product
from app.models.user import User
from app.schemas.order import OrderCreate, OrderUpdate, OrderResponse

class OrderService:
    def __init__(self, db: Session):
        self.db = db

    def create_order(self, order_data: OrderCreate, current_user: User) -> Order:
        # Validate that all products exist
        product_ids = [item.product_id for item in order_data.items]
        products = self.db.query(Product).filter(Product.id.in_(product_ids)).all()

        if len(products) != len(product_ids):
            found_ids = {p.id for p in products}
            missing_ids = set(product_ids) - found_ids
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Products not found: {', '.join(missing_ids)}"
            )

        # Create order
        new_order = Order(
            user_id=current_user.id,
            total=order_data.total,
            status="pending"
        )
        self.db.add(new_order)
        self.db.flush()

        # Create order items
        for item_data in order_data.items:
            order_item = OrderItem(
                order_id=new_order.id,
                product_id=item_data.product_id,
                quantity=item_data.quantity,
                price=item_data.price
            )
            self.db.add(order_item)

        self.db.commit()
        self.db.refresh(new_order)

        return new_order

    def get_user_orders(self, current_user: User, skip: int = 0, limit: int = 100) -> List[Order]:
        orders = self.db.query(Order).filter(
            Order.user_id == current_user.id
        ).options(
            # Eager load order items to prevent N+1 queries
            # from sqlalchemy.orm import joinedload
            # joinedload(Order.items)
        ).order_by(
            Order.created_at.desc()
        ).offset(skip).limit(limit).all()
        
        return orders

    def get_order_by_id(self, order_id: str) -> Optional[Order]:
        return self.db.query(Order).filter(Order.id == order_id).first()

    def get_order_with_auth(self, order_id: str, current_user: User) -> Order:
        order = self.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with id {order_id} not found"
            )

        # Check authorization (user owns order or is admin)
        if order.user_id != current_user.id and current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="You don't have permission to access this order"
            )
        return order

    def update_order_status(self, order_id: str, order_data: OrderUpdate, current_user: User) -> Order:
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can update order status"
            )

        order = self.get_order_by_id(order_id)
        if not order:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Order with id {order_id} not found"
            )

        if order_data.status:
            order.status = order_data.status

        self.db.commit()
        self.db.refresh(order)
        return order

    def get_all_orders(self, current_user: User, skip: int = 0, limit: int = 100, status_filter: Optional[str] = None) -> List[Order]:
        if current_user.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Only admins can view all orders"
            )

        query = self.db.query(Order)

        if status_filter:
            query = query.filter(Order.status == status_filter)

        orders = query.order_by(Order.created_at.desc()).offset(skip).limit(limit).all()
        return orders
