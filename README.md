# Don Mariano Delivery Orders

An internal web app for Tiendas Don Mariano. Branch staff use it to take home-delivery orders over the phone and track them until they are delivered. Each branch's data stays isolated from the others.

The product requirements are in [docs/PRD.md](docs/PRD.md).

## Stack

- **Backend:** Django 5.1, Django REST Framework, SimpleJWT, PostgreSQL 16
- **Frontend:** React, Vite, TypeScript
- **Infrastructure for local development:** Docker Compose runs PostgreSQL, plus Redis for real time in a later milestone

## Prerequisites

- Python 3.13
- Docker with Docker Compose
- Node.js and pnpm, for the frontend

## Backend setup

Run all commands from the repository root unless noted. On macOS or Linux, use `.venv/bin/python` instead of `.venv/Scripts/python`.

1. Start the database:

   ```bash
   docker compose up -d --wait db
   ```

2. Create the virtual environment and install dependencies:

   ```bash
   cd backend
   python -m venv .venv
   .venv/Scripts/python -m pip install -r requirements-dev.txt
   ```

3. Configure the environment. The defaults already match `docker-compose.yml`:

   ```bash
   cp .env.example .env
   ```

4. Apply migrations and load the development data:

   ```bash
   .venv/Scripts/python manage.py migrate
   .venv/Scripts/python manage.py seed_dev
   ```

   `seed_dev` creates a super admin, two branches with a branch admin and a staff user each, and a catalog for every branch. The login credentials are the `SEED_*` variables in `backend/.env.example`.

5. Run the API at http://localhost:8000:

   ```bash
   .venv/Scripts/python manage.py runserver
   ```

### Tests and checks

The tests run against the Compose PostgreSQL. pytest creates a separate test database.

```bash
cd backend
.venv/Scripts/python -m pytest
.venv/Scripts/ruff check .
.venv/Scripts/python manage.py check
```

## Frontend setup

```bash
cd frontend
pnpm install
pnpm dev
```

The app runs at http://localhost:5173 and calls the API at `VITE_API_URL`, which defaults to `http://localhost:8000`.

## API overview

All endpoints are under `/api/` and need a `Bearer` access token, except login and refresh.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/login/`, `POST /api/auth/refresh/`, `GET /api/auth/me/` | Authentication |
| `/api/branches/` | Branch management. Super admin only. |
| `/api/users/` | User management. Super admins manage every user; branch admins manage staff in their own branch. |
| `/api/products/` | Branch catalog, with `?search=` |
| `/api/customers/`, `GET /api/customers/lookup/?phone=` | Customer lookup |
| `/api/orders/`, `POST .../transition/`, `POST .../cancel/` | Orders and their lifecycle |

Branch-scoped endpoints (products, customers and orders) always act within one branch. Branch users act in their own branch. A super admin must choose a branch with the `X-Branch-Id` header.

## Project layout

```
.
├── backend/              Django project
│   ├── config/           Settings (base, development, production, test) and URLs
│   └── apps/
│       ├── common/       Branch scoping, permissions, text normalization, Postgres extensions
│       ├── users/        Custom user, roles and authentication
│       ├── branches/     Branches
│       ├── catalog/      Products per branch
│       ├── customers/    Customers and their saved addresses
│       └── orders/       Orders, items, status history and domain rules (services.py)
├── frontend/             React + Vite app
├── docs/                 PRD and other documentation
└── docker-compose.yml    PostgreSQL and Redis for local development
```
