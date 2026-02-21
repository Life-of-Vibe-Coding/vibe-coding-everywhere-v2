# ShopHub Backend API

FastAPI-based e-commerce backend with SQLAlchemy ORM, JWT authentication, and RESTful API design.

## 🚀 Features

- **Authentication**: JWT-based auth with bcrypt password hashing
- **Products**: Full CRUD operations with filtering and search
- **Orders**: Order creation and management with item tracking
- **Security**: Input validation, SQL injection protection, role-based access
- **Database**: SQLAlchemy ORM (SQLite/PostgreSQL support)
- **API Docs**: Auto-generated Swagger UI and ReDoc

## 📦 Tech Stack

- **FastAPI** - Modern Python web framework
- **SQLAlchemy** - SQL ORM
- **Pydantic** - Data validation
- **python-jose** - JWT tokens
- **passlib** - Password hashing
- **uvicorn** - ASGI server

## 🛠️ Setup

### 1. Create Virtual Environment

```bash
cd backend
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

**Important:** Change `SECRET_KEY` in production!

```bash
# Generate a secure secret key
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

### 4. Run Database Migrations

The database will be automatically initialized on first startup.

### 5. Start the Server

```bash
# Development (with auto-reload)
uvicorn app.main:app --reload --port 8000

# Production
uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## 📚 API Documentation

Once the server is running:

- **Swagger UI**: http://localhost:8000/docs
- **ReDoc**: http://localhost:8000/redoc
- **Health Check**: http://localhost:8000/health

## 🔑 API Endpoints

### Authentication

- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login and get JWT token
- `GET /api/v1/auth/me` - Get current user info

### Products

- `GET /api/v1/products` - List products (with filters)
- `GET /api/v1/products/{id}` - Get product by ID
- `POST /api/v1/products` - Create product (admin only)
- `PATCH /api/v1/products/{id}` - Update product (admin only)
- `DELETE /api/v1/products/{id}` - Delete product (admin only)

### Orders

- `POST /api/v1/orders` - Create new order
- `GET /api/v1/orders` - Get user's orders
- `GET /api/v1/orders/{id}` - Get order by ID
- `PATCH /api/v1/orders/{id}` - Update order status (admin only)
- `GET /api/v1/orders/admin/all` - Get all orders (admin only)

## 🔒 Authentication

All protected endpoints require a JWT token in the Authorization header:

```bash
Authorization: Bearer <your_jwt_token>
```

### Example: Register and Login

```bash
# Register
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123", "name": "John Doe"}'

# Login
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com", "password": "password123"}'
```

## 🗄️ Database

### SQLite (Development)

```env
DATABASE_URL=sqlite:///./shophub.db
```

### PostgreSQL (Production)

```env
DATABASE_URL=postgresql://user:password@localhost:5432/shophub
```

## 🧪 Testing

```bash
# Install test dependencies
pip install pytest pytest-asyncio httpx

# Run tests
pytest
```

## 📁 Project Structure

```
backend/
├── app/
│   ├── api/
│   │   └── v1/
│   │       ├── endpoints/      # API route handlers
│   │       │   ├── auth.py
│   │       │   ├── products.py
│   │       │   └── orders.py
│   │       └── router.py       # API router
│   ├── core/
│   │   ├── config.py          # Settings & config
│   │   ├── database.py        # Database setup
│   │   └── security.py        # Auth utilities
│   ├── models/                # SQLAlchemy models
│   │   ├── user.py
│   │   ├── product.py
│   │   └── order.py
│   ├── schemas/               # Pydantic schemas
│   │   ├── user.py
│   │   ├── product.py
│   │   └── order.py
│   └── main.py               # FastAPI app
├── tests/                    # Test files
├── .env.example             # Environment template
├── .gitignore
├── requirements.txt
└── README.md
```

## 🔐 Security Checklist

- ✅ **SQL Injection**: Parameterized queries via SQLAlchemy ORM
- ✅ **XSS**: Pydantic validation on all inputs
- ✅ **Auth**: JWT tokens with expiration
- ✅ **Secrets**: Environment variables (never hardcoded)
- ✅ **Password**: Bcrypt hashing
- ✅ **CORS**: Configured for frontend origin
- ✅ **Error Messages**: No stack traces exposed to clients

## 🚀 Deployment

### Using Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ./app ./app

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Environment Variables (Production)

```env
DATABASE_URL=postgresql://user:password@db:5432/shophub
SECRET_KEY=<your-secure-secret-key>
ENVIRONMENT=production
FRONTEND_URL=https://yourdomain.com
```

## 📝 License

This project is part of ShopHub full-stack application.
