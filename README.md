# Don Mariano Delivery Orders

An internal web app for Tiendas Don Mariano. Branch staff use it to take home-delivery orders over the phone and track them until they are delivered. Each branch's data stays isolated from the others.

The product requirements are in [docs/PRD.md](docs/PRD.md).

## Stack

- **Backend:** Django 5.1, Django REST Framework, SimpleJWT, PostgreSQL 16
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, React Router, Zustand, TanStack Query
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

### Tests and checks

```bash
cd frontend
pnpm test    # Vitest + Testing Library (jsdom)
pnpm lint    # oxlint
pnpm build   # type-check and production build
```

## API overview

All endpoints are under `/api/` and need a `Bearer` access token, except login and refresh.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/auth/login/`, `POST /api/auth/refresh/`, `GET /api/auth/me/` | Authentication |
| `/api/branches/` | Branch management. Super admin only. |
| `/api/users/` | User management. Super admins manage every user; branch admins manage staff in their own branch. |
| `/api/products/` | Branch catalog. Filters: `?search=` (ranked, typo tolerant), `?category=`, `?is_active=`. `POST .../activate/` reactivates |
| `GET /api/products/autocomplete/?q=&limit=` | Top active matches for the order cart (default 10) |
| `GET /api/products/categories/` | Distinct categories of the branch |
| `GET /api/products/import-template/`, `POST /api/products/import/preview/`, `POST /api/products/import/apply/` | Excel import (.xlsx): template, preview without writing, then apply. Branch admins and above |
| `/api/customers/`, `GET /api/customers/lookup/?phone=` | Customer lookup. Saved addresses come most recently used first |
| `/api/orders/` | Orders, newest first. Filters: `?status=pending,preparing`, `?active=true` (not delivered or cancelled), `?board=true` (active orders plus the ones delivered or cancelled on `?date=`, today by default), `?date=YYYY-MM-DD` without `board` (created that day), `?since=<ISO 8601>` (changed after that moment). `?page_size=` up to 200. List rows are light (`item_count`, no items); the detail adds items and the status history. `PATCH` edits pending and preparing orders (items, payment, total, notes, customer and address) |
| `POST /api/orders/{id}/transition/`, `POST /api/orders/{id}/cancel/` | Lifecycle. `transition` takes `to_status` (the next status or `"next"`); `cancel` requires `reason`. Both accept `expected_status`, the status the screen showed: if the order changed meanwhile the API answers `409` with `"Este domicilio ya cambió de estado…"` |

Creating or editing an order sends a `customer` block with `phone`, `name`, `address_notes` and either `address_id` (one of the customer's saved addresses) or `address` (a new one, saved for next time). Phones are stored as digits only, without the Colombian `+57` prefix, so `+57 300 123 4567` and `300-123-4567` are the same customer.

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
