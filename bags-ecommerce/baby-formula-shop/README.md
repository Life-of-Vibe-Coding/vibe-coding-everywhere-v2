# NutriNest Formula (Next.js + Prisma)

Full-stack e-commerce starter focused on baby formula. Includes a product catalog, product detail pages, cart state, and Prisma + SQLite backend.

## Tech Stack
- Next.js App Router (TypeScript)
- Prisma ORM + SQLite
- Tailwind CSS
- Vitest for unit testing

## Getting Started

```bash
cd baby-formula-shop
npm install
```

### 1) Configure environment

```bash
cp .env.example .env
```

### 2) Run migrations + seed data

```bash
npx prisma migrate dev --name init
npm run prisma:seed
```

### 3) Start the dev server

```bash
npm run dev
```

Open http://localhost:3000.

## Useful Scripts

- `npm run prisma:seed` – Seed the database
- `npm run test` – Run unit tests
- `npm run lint` – Lint the project

## Notes
- Payments and authentication are intentionally omitted.
- Cart is client-side and stored in localStorage.
