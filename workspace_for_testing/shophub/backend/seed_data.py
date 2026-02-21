"""
Database seeding script for development/testing.
Creates sample products and an admin user.
"""
from app.core.database import SessionLocal, init_db
from app.core.security import get_password_hash
from app.models.user import User
from app.models.product import Product


def seed_database():
    """Seed the database with sample data."""
    
    # Initialize database
    print("🗄️  Initializing database...")
    init_db()
    
    db = SessionLocal()
    
    try:
        # Check if data already exists
        existing_products = db.query(Product).count()
        if existing_products > 0:
            print("⚠️  Database already has data. Skipping seed.")
            return
        
        print("🌱 Seeding database...")
        
        # Create admin user
        admin = User(
            email="admin@shophub.com",
            password=get_password_hash("admin123"),
            name="Admin User",
            role="admin"
        )
        db.add(admin)
        
        # Create customer user
        customer = User(
            email="customer@example.com",
            password=get_password_hash("password123"),
            name="John Doe",
            role="customer"
        )
        db.add(customer)
        
        # Create sample products
        products = [
            Product(
                name="Wireless Headphones",
                description="Premium noise-canceling wireless headphones with 30-hour battery life",
                price=299.99,
                image="https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=500",
                category="electronics",
                stock=50,
                featured=True
            ),
            Product(
                name="Smart Watch",
                description="Fitness tracking smartwatch with heart rate monitor and GPS",
                price=399.99,
                image="https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=500",
                category="electronics",
                stock=30,
                featured=True
            ),
            Product(
                name="Laptop Backpack",
                description="Durable water-resistant backpack with laptop compartment",
                price=79.99,
                image="https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=500",
                category="accessories",
                stock=100,
                featured=False
            ),
            Product(
                name="Coffee Maker",
                description="Programmable coffee maker with thermal carafe",
                price=129.99,
                image="https://images.unsplash.com/photo-1517668808822-9ebb02f2a0e6?w=500",
                category="home",
                stock=25,
                featured=False
            ),
            Product(
                name="Running Shoes",
                description="Lightweight running shoes with cushioned sole",
                price=159.99,
                image="https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=500",
                category="sports",
                stock=75,
                featured=True
            ),
            Product(
                name="Yoga Mat",
                description="Non-slip yoga mat with carrying strap",
                price=49.99,
                image="https://images.unsplash.com/photo-1601925260368-ae2f83cf8b7f?w=500",
                category="sports",
                stock=150,
                featured=False
            ),
            Product(
                name="Desk Lamp",
                description="LED desk lamp with adjustable brightness and color temperature",
                price=89.99,
                image="https://images.unsplash.com/photo-1513506003901-1e6a229e2d15?w=500",
                category="home",
                stock=60,
                featured=False
            ),
            Product(
                name="Bluetooth Speaker",
                description="Portable waterproof Bluetooth speaker",
                price=129.99,
                image="https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=500",
                category="electronics",
                stock=40,
                featured=True
            ),
        ]
        
        for product in products:
            db.add(product)
        
        db.commit()
        
        print("✅ Database seeded successfully!")
        print(f"📦 Created {len(products)} products")
        print("👤 Created admin user: admin@shophub.com / admin123")
        print("👤 Created customer user: customer@example.com / password123")
        
    except Exception as e:
        print(f"❌ Error seeding database: {e}")
        db.rollback()
    finally:
        db.close()


if __name__ == "__main__":
    seed_database()
