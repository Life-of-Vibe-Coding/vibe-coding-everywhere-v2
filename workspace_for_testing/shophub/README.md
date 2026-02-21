# ShopHub - Full Stack E-Commerce Application

A modern full-stack e-commerce application with **Python FastAPI backend** and **Next.js frontend**.

## 🏗️ Architecture

```
shophub/
├── backend/           # FastAPI Python backend
│   ├── app/
│   │   ├── api/      # REST API endpoints
│   │   ├── core/     # Config, database, security
│   │   ├── models/   # SQLAlchemy ORM models
│   │   └── schemas/  # Pydantic validation schemas
│   └── requirements.txt
│
├── app/              # Next.js frontend (React)
├── components/       # React components
├── lib/              # Utilities & API client
└── package.json
```

## 🚀 Tech Stack

### Backend
- **FastAPI** - High-performance Python web framework
- **SQLAlchemy** - SQL ORM
- **Pydantic** - Data validation
- **JWT** - Authentication
- **bcrypt** - Password hashing
- **SQLite/PostgreSQL** - Database

### Frontend
- **Next.js 14** - React framework
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **Zustand** - State management

## 📦 Getting Started

### Prerequisites
- Python 3.11+
- Node.js 18+
- npm or yarn

### 1. Setup Backend

```bash
cd backend

# Create virtual environment
python3 -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your settings (especially SECRET_KEY)

# Seed database (creates sample data + admin user)
python seed_data.py

# Run backend server
python run.py
```

Backend runs on **http://localhost:8000**
- API Docs (Swagger): http://localhost:8000/docs
- Alternative Docs (ReDoc): http://localhost:8000/redoc

### 2. Setup Frontend

```bash
# From shophub root directory

# Install dependencies
npm install

# Configure environment
cp .env.example .env.local
# Edit .env.local if needed (API_URL defaults to localhost:8000)

# Run frontend development server
npm run dev
```

Frontend runs on **http://localhost:3000**

## 🔑 Default Credentials (After Seeding)

**Admin Account:**
- Email: `admin@shophub.com`
- Password: `admin123`

**Customer Account:**
- Email: `customer@example.com`
- Password: `password123`

## 📚 API Endpoints

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login
- `GET /api/v1/auth/me` - Get current user

### Products
- `GET /api/v1/products` - List products (filters: category, featured, search)
- `GET /api/v1/products/{id}` - Get product
- `POST /api/v1/products` - Create product (admin only)
- `PATCH /api/v1/products/{id}` - Update product (admin only)
- `DELETE /api/v1/products/{id}` - Delete product (admin only)

### Orders
- `POST /api/v1/orders` - Create order
- `GET /api/v1/orders` - Get user orders
- `GET /api/v1/orders/{id}` - Get order by ID
- `PATCH /api/v1/orders/{id}` - Update order status (admin only)
- `GET /api/v1/orders/admin/all` - Get all orders (admin only)

## 🔒 Security Features

- ✅ JWT-based authentication
- ✅ Bcrypt password hashing
- ✅ SQL injection protection (SQLAlchemy ORM)
- ✅ Input validation (Pydantic)
- ✅ CORS configuration
- ✅ Role-based access control
- ✅ Environment variable secrets

## 🧪 Testing

### Backend Tests
```bash
cd backend
pytest
```

### Frontend Tests
```bash
npm test
```

## 📁 Project Structure

### Backend (`/backend`)
```
app/
├── api/v1/
│   ├── endpoints/
│   │   ├── auth.py       # Authentication routes
│   │   ├── products.py   # Product CRUD
│   │   └── orders.py     # Order management
│   └── router.py         # API router
├── core/
│   ├── config.py         # App configuration
│   ├── database.py       # Database setup
│   └── security.py       # JWT & password utils
├── models/               # SQLAlchemy models
│   ├── user.py
│   ├── product.py
│   └── order.py
├── schemas/              # Pydantic schemas
│   ├── user.py
│   ├── product.py
│   └── order.py
└── main.py              # FastAPI app
```

### Frontend (`/app`, `/components`, `/lib`)
```
app/
├── page.tsx              # Home page
├── products/             # Product pages
├── cart/                 # Shopping cart
├── orders/               # Order history
├── login/                # Login page
└── register/             # Registration

components/
├── Navbar.tsx
├── ProductCard.tsx
└── ...

lib/
├── api.ts               # API client
└── ...
```

## 🚀 Deployment

### Backend (FastAPI)

**Option 1: Docker**
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY ./app ./app
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Option 2: Platform as a Service**
- Deploy to Railway, Render, or Fly.io
- Set environment variables
- Use PostgreSQL instead of SQLite

### Frontend (Next.js)

**Vercel (Recommended)**
```bash
vercel deploy
```

**Environment Variables:**
- `NEXT_PUBLIC_API_URL` - Backend API URL
- `NEXTAUTH_SECRET` - NextAuth secret key

## 📝 Development Workflow

1. **Start Backend**: `cd backend && python run.py`
2. **Start Frontend**: `npm run dev`
3. **Open Browser**: http://localhost:3000
4. **API Docs**: http://localhost:8000/docs

## 🔧 Common Tasks

### Add New API Endpoint
1. Create route in `backend/app/api/v1/endpoints/`
2. Add to router in `backend/app/api/v1/router.py`
3. Update frontend API client in `lib/api.ts`

### Add New Database Model
1. Create model in `backend/app/models/`
2. Create Pydantic schema in `backend/app/schemas/`
3. Add to `backend/app/models/__init__.py`
4. Restart server (auto-creates tables)

### Change Database to PostgreSQL
1. Update `DATABASE_URL` in `backend/.env`:
   ```
   DATABASE_URL=postgresql://user:password@localhost:5432/shophub
   ```
2. Install psycopg2: `pip install psycopg2-binary`
3. Restart backend

## 📖 Documentation

- [Backend API Docs](http://localhost:8000/docs) (when running)
- [Next.js Documentation](https://nextjs.org/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com)
- [SQLAlchemy Documentation](https://docs.sqlalchemy.org)

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

---

**Happy Coding! 🎉**
