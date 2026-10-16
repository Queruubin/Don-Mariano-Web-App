# Don Mariano Delivery Orders

An internal web app for Tiendas Don Mariano. Branch staff use it to take home-delivery orders over the phone and track them until they are delivered. Each branch's data stays isolated from the others.

The product requirements are in [docs/PRD.md](docs/PRD.md).

## Stack

- **Backend:** Django 5.1, Django REST Framework, SimpleJWT, PostgreSQL 16, Django Channels with Redis for real time, served by Daphne (ASGI)
- **Frontend:** React 19, Vite, TypeScript, Tailwind CSS v4, React Router, Zustand, TanStack Query
- **Infrastructure for local development:** Docker Compose runs PostgreSQL and Redis

## Prerequisites

- Python 3.13
- Docker with Docker Compose
- Node.js and pnpm, for the frontend

## Backend setup

Run all commands from the repository root unless noted. On macOS or Linux, use `.venv/bin/python` instead of `.venv/Scripts/python`.

1. Start the database and Redis:

   ```bash
   docker compose up -d --wait db redis
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

   Daphne is installed as a Django app, so `runserver` is an ASGI server that serves both HTTP and the WebSocket at `/ws/branch/`. In production, run `daphne -b 0.0.0.0 -p 8000 config.asgi:application`.

### Environment variables for real time

| Variable | Default | Purpose |
| --- | --- | --- |
| `REDIS_URL` | `redis://localhost:6379/0` | Channel layer that carries events between server processes |
| `CORS_ALLOWED_ORIGINS` | the Vite dev origins | Browser origins allowed to call the API. Sockets accept the same origins |
| `WEBSOCKET_ALLOWED_ORIGINS` | empty (same as CORS) | Production only. Overrides the origins allowed to open sockets |

If Redis is down, the API keeps working. Publishing an event fails fast, is logged, and is skipped for a few seconds. Open screens fall back to polling.

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

The app runs at http://localhost:5173 and calls the API at `VITE_API_URL`, which defaults to `http://localhost:8000`. The real-time socket uses `VITE_WS_URL`. By default it is the API host with `ws://` or `wss://` plus `/ws/branch/`, for example `ws://localhost:8000/ws/branch/`.

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

## Real time

Every open screen of a branch receives order changes as they happen (PRD FR-30). The board polls every 15 seconds while the connection is down, and every 60 seconds as a safety net while it is live. After each reconnection it refetches once to catch up.

### WebSocket protocol (`/ws/branch/`)

1. The client opens the socket. The token never goes in the URL, because URLs end up in logs.
2. Within 5 seconds the client sends `{"type": "auth", "token": "<access token>", "branch_id": <id or null>}`. Branch users always join their own branch, and `branch_id` is ignored. A super admin must send an active branch.
3. The server answers `{"type": "auth.ok", "branch_id": 1, "user_id": 3}`. From then on it pushes events of that branch only.
4. The client sends `{"type": "ping"}` every 25 seconds and the server answers `{"type": "pong"}`. The server closes a socket that is silent for 75 seconds. The client reconnects if a pong does not arrive within 10 seconds.

Events are published only after the database transaction commits:

```json
{
  "type": "order.status_changed",
  "event_id": "9f1c…",
  "sent_at": "2026-10-15T10:05:00.123456-05:00",
  "actor_id": 3,
  "branch_id": 1,
  "order": { "id": 42, "number": 142, "status": "preparing", "updated_at": "…", "item_count": 2 },
  "from_status": "pending",
  "to_status": "preparing"
}
```

The types are `order.created`, `order.updated`, `order.status_changed` and `order.cancelled`. `from_status` and `to_status` come with the last two. `order` has the same fields as a row of `GET /api/orders/`. The client drops repeated `event_id`s and ignores an event whose `order.updated_at` is older than the card it already shows.

Close codes tell the client what to do:

| Code | Meaning | Client action |
| --- | --- | --- |
| 4401 | Bad token, or the user or branch is inactive | Refresh the token and retry once, then back off |
| 4403 | Not allowed in that branch | Do not retry until the branch changes |
| 4408 | No auth message in time | Retry with backoff |
| 4419 | The access token expired while connected | Refresh the token and reconnect right away |
| 4400 | Malformed message | Retry with backoff |
| 4002 | No ping for too long | Retry with backoff |
| 4503 | The server cannot reach Redis | Retry with backoff |

Backoff doubles from 1 second up to 30 seconds, with jitter. The client also reconnects right away when the network comes back or the tab becomes visible.

A new order taken by someone else plays a short chime, highlights its card for 10 seconds and shows a "Nuevo domicilio" notice. Browsers block sound until the user taps the page, so the board asks once to turn the sound on. While the tab is hidden, the title counts new orders, for example "(2) Don Mariano · Domicilios".

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
│       ├── orders/       Orders, items, status history, domain rules (services.py) and real-time events (events.py)
│       └── realtime/     WebSocket consumer, socket authentication and publishing to branch groups
├── frontend/             React + Vite app
├── docs/                 PRD and other documentation
└── docker-compose.yml    PostgreSQL and Redis for local development
```
