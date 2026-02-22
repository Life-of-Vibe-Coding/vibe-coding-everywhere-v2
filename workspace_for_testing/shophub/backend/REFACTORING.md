# ShopHub Python Backend Refactoring

## Overview

This document outlines the planned refactoring for the ShopHub Python Backend to enhance its architecture, maintainability, and testability, mirroring the improvements made to the Next.js API routes.

## Refactoring Principles to Apply

We will adhere to the following principles, aligning with the "Refactor Skill" guidelines:

1.  **Behavior is preserved**: All existing functionality must remain unchanged.
2.  **Small, focused changes**: Each modification should be atomic and easy to review.
3.  **Type safety**: Leverage Python's type hints for stronger typing.
4.  **DRY (Don't Repeat Yourself)**: Eliminate duplicated logic, especially around database interactions and business rules.
5.  **Single Responsibility Principle**: Ensure each class and function has one clear purpose.

## Current Code Smells (to be addressed)

### 1. Business Logic in Endpoint Functions
**Before**: FastAPI endpoint functions directly handle database operations, filtering, and core business logic (e.g., `create_product`, `get_products` in `app/api/v1/endpoints/products.py`).
**After**: Extract business logic into dedicated service classes. Endpoint functions will become thin controllers.

## Proposed New Architecture Segment (Services Layer)

```
shophub/backend/app/
├── api/
│   └── v1/
│       └── endpoints/
│           └── products.py     # Thin controllers, call services
│
├── services/                   # 🆕 Business logic layer
│   ├── __init__.py
│   ├── product.py              # Product-related business logic and DB ops
│   ├── order.py                # Order-related business logic and DB ops
│   └── user.py                 # User-related business logic and DB ops
│
├── core/
├── models/
├── schemas/
└── main.py
```

## Key Improvements (Planned)

### 1. Service Layer Pattern
Introduce service classes to encapsulate business logic and database operations.

**Before (Example from `app/api/v1/endpoints/products.py`):**
```python
# In endpoint function
new_product = Product(**product_data.model_dump())
db.add(new_product)
db.commit()
db.refresh(new_product)
```

**After (Planned):**
```python
# In app/services/product.py
class ProductService:
    def __init__(self, db: Session):
        self.db = db

    def create_product(self, product_data: ProductCreate) -> Product:
        new_product = Product(**product_data.model_dump())
        self.db.add(new_product)
        self.db.commit()
        self.db.refresh(new_product)
        return new_product

# In endpoint function (app/api/v1/endpoints/products.py)
from app.services.product import ProductService

@router.post(...)
def create_product(..., db: Session = Depends(get_db), ...):
    product_service = ProductService(db) # Dependency injection for service
    new_product = product_service.create_product(product_data)
    return new_product
```

### 2. Centralized Query Building and Filtering
Move complex query construction (e.g., filtering, searching, pagination for `get_products`) into the respective service methods.

### 3. Standardized Error Handling (Future Consideration)
Investigate ways to standardize and centralize error responses and exception handling across the API.

## Benefits (Expected)

### 🎯 Maintainability
-   **Single Responsibility**: Endpoints focus on HTTP; services focus on business logic.
-   **Readability**: Endpoint functions will be shorter and clearer.

### 🔒 Type Safety
-   Enhanced use of type hints in service methods.

### 🧪 Testability
-   Services can be unit-tested in isolation without mocking the entire FastAPI context.

### 🚀 Scalability
-   Clear architectural boundaries will make it easier to add new features or scale the application.

## Next Steps (Immediate)

1.  **Create `app/services` directory and `__init__.py`**.
2.  **Implement `app/services/product.py`**:
    *   Create a `ProductService` class.
    *   Move the `create_product` logic from the endpoint into a `create_product` method in this service.
    *   Update the `create_product` endpoint to use `ProductService`.
3.  **Refactor `get_products`**: Move the filtering, searching, and pagination logic into a `get_products` method in `ProductService`.
4.  **Refactor `update_product` and `delete_product`**: Move their logic into `ProductService`.
