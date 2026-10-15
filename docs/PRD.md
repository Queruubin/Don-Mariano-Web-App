# PRD — Don Mariano Delivery Orders (internal app)

| Field | Value |
| --- | --- |
| Status | Draft v1 |
| Date | 2026-10-14 |
| Owner | Samuel |
| Client | Tiendas Don Mariano (neighborhood supermarket, Bogotá) |

## 1. Problem

Don Mariano takes home-delivery orders ("domicilios") by phone. Staff currently write them down by hand. That makes them slow, error-prone, and hard to track across branches ("sedes"). The store delivers **exactly** what the customer asks for: "bien verde" avocados, a "muy madura" papaya. Those per-item notes get lost.

## 2. Goal

An **internal** web app where branch staff create a delivery order while they are on the phone with the customer. Creating the order must be as easy as filling a shopping cart. The team then tracks the order until it is delivered, and each branch's data stays isolated.

### Success metrics

- An order with 5 items is created in **under 2 minutes** during a call.
- A staff member with low tech literacy creates their first order **without training**, beyond a 5-minute demo.
- **Zero cross-branch data leaks**: a branch user never sees another branch's orders, products or customers.
- New orders appear on the other screens of the same branch in **under 2 seconds**.

### Non-goals (v1)

- A customer-facing app or ordering by customers themselves.
- Per-product prices, stock or inventory. Prices change too often, so the order total is typed manually.
- Payment processing or integrations (POS, Nequi or Daviplata APIs).
- A delivery-driver role and route assignment.
- Dashboards, charts and Excel export of orders.
- Native mobile apps. The product is a responsive web app.

## 3. Users and roles

| Role | Scope | Can do |
| --- | --- | --- |
| **Super admin** | All branches | CRUD branches and users of any role. Everything a branch admin can do, in any branch. |
| **Branch admin** | One branch | Manage the branch catalog (Excel import, add, edit and deactivate products) and the branch's staff users. View order history with filters. Everything branch staff can do. |
| **Branch staff** | One branch | Create, edit and cancel orders, move orders through statuses, and look up customers. |

Personas:
- **Doña Gloria (staff):** 50+ years old, uses WhatsApp and little else. Takes calls on the branch tablet. Needs big buttons and few decisions.
- **Andrés (branch admin):** manages the branch, comfortable with Excel.
- **Owner (super admin):** opens branches and creates accounts.

## 4. Functional requirements

### 4.1 Authentication and tenancy

- FR-1: Users log in with email and password. Sessions last a full shift: an 8h access token with a rotating refresh token.
- FR-2: Every branch-scoped resource (products, customers, orders) belongs to exactly one branch. The backend **must** enforce scoping on every query. Hiding things in the frontend is not enough.
- FR-3: The super admin picks a branch from a selector to act inside it.
- FR-4: Deactivated users and branches cannot log in or operate.

### 4.2 Branch and user management

- FR-5: The super admin creates, edits and deactivates branches: name, address, phone.
- FR-6: The super admin creates users of any role. A branch admin creates and deactivates staff users only in their own branch.
- FR-7: An admin can reset another user's password. There is no self-service email reset in v1.

### 4.3 Catalog (per branch)

- FR-8: A product has: name, **default unit**, optional category, and an active flag. There is **no price**.
- FR-9: Units are: `unidad`, `libra`, `kilo`, `gramos`, `paquete` and `pesos ($)`. The last one covers requests like "$5.000 de cilantro".
- FR-10: The branch admin imports products from an **.xlsx** file with columns `nombre`, `unidad`, `categoria`:
  - The import is an upsert by normalized name within the branch.
  - Before applying anything, the admin sees a preview: new, updated and invalid rows with their reasons.
  - A downloadable template file is provided.
- FR-11: The branch admin can add, edit and deactivate products by hand. Products are deactivated, never hard-deleted, so past orders keep their references.
- FR-12: Product search is **case-insensitive and accent-insensitive** ("aguacate" ≈ "Aguacáte") and matches partial words ("papa" finds "Papaya" and "Papa criolla").

### 4.4 Customers (per branch)

- FR-13: Phone number is the lookup key. When staff type a phone number that already exists, the customer's name and address are filled in automatically.
- FR-14: A customer can have **several saved addresses**. Staff pick one or add a new one.
- FR-15: Customer data is created or updated as a side effect of publishing an order. There is no separate screen in v1.

### 4.5 Create order (core flow)

All of this happens on **one screen**, with three clear blocks from top to bottom (on a tablet in landscape: cart on the left, customer and payment on the right):

1. **Customer:** phone (with autocomplete per FR-13), name, address (saved addresses or a new one) and an optional address note ("apto 302, timbre dañado").
2. **Products (the "cart"):**
   - FR-16: One large search input with **autocomplete**. Typing 2 or more characters shows matches; tapping or pressing Enter adds the product.
   - FR-17: Each line has a quantity with large **− / +** buttons and decimals allowed (1.5 libras), a unit pre-filled from the product's default but changeable, and an optional **note** ("muy madura").
   - FR-18: If nothing matches, the dropdown offers **"Agregar '<texto>' como producto libre"**. That adds a free-text line that is not saved to the catalog.
   - FR-19: Lines can be removed, and adding the same product twice is allowed, since it may come with a different note.
3. **Closing:**
   - FR-20: The payment method is chosen with large toggle buttons: **Efectivo, Tarjeta, Nequi, Daviplata**.
   - FR-21: **Order total** is typed manually in COP and is required. The app does not calculate it.
   - FR-22: **"Paga con"** is optional and only shown for Efectivo. It is the amount the customer pays with, so the driver can bring change. The change due is shown.
   - FR-23: There is an optional general note for the order.
   - FR-24: A big **"Publicar domicilio"** button. Validation shows friendly inline messages next to the fields, not technical errors.
- FR-25: The draft is kept locally, so an accidental refresh or navigation does not lose a half-taken order.
- FR-26: Each order gets a short, human-friendly **number per branch** (for example #0142).

### 4.6 Order board and lifecycle

- FR-27: The branch home is an **order board** that lists active orders, newest first, grouped or filterable by status.
- FR-28: The statuses are: `Pendiente → Alistando → En camino → Entregado`, and `Cancelado` from any non-final status. Moving an order forward takes **one tap** ("Siguiente: En camino"). Cancelling asks for confirmation and a reason.
- FR-29: Orders can be edited while they are `Pendiente` or `Alistando`. After that they are read-only.
- FR-30: **Real time:** creates, edits and status changes show up on every open screen of the same branch without a reload. A new order plays a **sound** and highlights its card.
  - Browsers block audio until the user interacts with the page. The board shows a one-time "Activar sonido" prompt.
  - If the real-time connection drops, the board reconnects automatically and refetches.
- FR-31: The order detail view shows everything, plus a status history with who changed it and when. A **print-friendly** view is included so the order can be handed to the picker or driver.

### 4.7 History (admins)

- FR-32: A paginated order history with filters: date range, status, payment method, staff member, and customer phone.

## 5. Non-functional requirements

- **Usability (top priority):**
  - Tablet-first responsive design that also works well on a phone (360px) and a desktop PC.
  - Touch targets of at least 48px and base font size of at least 18px.
  - Plain Spanish labels with no jargon, and icons together with text.
  - At most 2 levels of navigation.
- **Language and locale:** the UI is in Spanish (Colombia). Money is shown as `$ 45.000`, in the America/Bogota timezone.
- **Accessibility:** WCAG AA contrast and visible focus states. Never rely on color alone, so statuses show a label and an icon too.
- **Performance:** autocomplete answers in under 300ms for up to about 3,000 products per branch.
- **Security:** branch scoping enforced on the server, role-based permissions, and passwords hashed (Django default). HTTPS is required in production.
- **Reliability:** the real-time channel is an enhancement. If it fails, the board falls back to polling every 15s.
- **Hosting:** to be decided. The architecture must be deployable on either a VPS (Docker) or a PaaS that supports WebSockets.

## 6. Visual design

Taken from the landing page (`Landing-Tiendas-Don-Mariano`), but **lighter**. The landing uses a dark brown background; the app inverts this to a light, warm surface and keeps brown, green and gold as accents.

| Token | Value | Use |
| --- | --- | --- |
| `bg` | `#fdfbf9` (brown-100) | App background |
| `surface` | `#ffffff` | Cards and inputs |
| `surface-alt` | `#fbeede` (brown-200) | Section headers, selected rows |
| `primary` | `#308334` (green-500) | Primary actions ("Publicar", "Siguiente estado") |
| `primary-hover` | `#1f5d24` (green-600) | Hover and pressed states |
| `accent` | `#f4b71e` (gold-500) | Highlights, the new-order badge |
| `text` | `#3a270d` (brown-700) | Body text |
| `text-muted` | `#553813` (brown-600) | Secondary text, header |
| `danger` | to be defined (accessible red) | Cancel, errors |

- **Typography:** Comfortaa for headings and brand. For body text and inputs, a highly legible sans-serif (for example Nunito or Inter), because Comfortaa is hard to read at small sizes and in numbers.
- **Logo:** `logo_letter.png` (wordmark) in the header and `LogoDon.png` as favicon and app icon. Ask the client for an SVG version if one exists.
- **Shape language:** rounded corners and pill-shaped buttons, as on the landing.
- **Status colors:**

  | Status | Color |
  | --- | --- |
  | Pendiente | gold |
  | Alistando | brown |
  | En camino | blue |
  | Entregado | green |
  | Cancelado | gray / red |

  Each status always shows an icon and a label as well.

## 7. Data model (target)

```
Branch(id, name, address, phone, is_active)
User(id, email, name, role[super_admin|branch_admin|branch_staff], branch_id?, is_active)
Product(id, branch_id, name, normalized_name, default_unit, category?, is_active)
    unique(branch_id, normalized_name)
Customer(id, branch_id, phone, name)                     unique(branch_id, phone)
CustomerAddress(id, customer_id, address, notes?, last_used_at)
Order(id, branch_id, number, customer_id, address_snapshot, address_notes?,
      payment_method[cash|card|nequi|daviplata], total_amount, pays_with?,
      notes?, status, cancel_reason?, created_by, created_at, updated_at)
      unique(branch_id, number)
OrderItem(id, order_id, product_id?, name_snapshot, quantity(decimal), unit, notes?)
      -- product_id is null for free-text items
OrderStatusEvent(id, order_id, from_status, to_status, changed_by, changed_at)
```

## 8. Technical direction

Keep the existing stack. It fits the problem.

- **Backend:** Django 5 + DRF + SimpleJWT.
  - Add **Django Channels + Redis** for WebSockets, with one group per branch.
  - Add `openpyxl` for the Excel import.
- **Database:** move to **PostgreSQL**. It gives `unaccent` and `pg_trgm` for accent-insensitive and fuzzy search, and it handles concurrent writes. Keep SQLite only for local tests, if desired.
- **Frontend:** React 19 + Vite + TypeScript + Tailwind v4 (theme tokens from section 6) + react-router + zustand.
  - Add TanStack Query for server state and cache invalidation driven by socket events.
- **Testing:** pytest-django for the scoping and permission rules, which are critical, and Vitest + Testing Library for the order form.

### Gap analysis vs. current code

| Area | Current | Change needed |
| --- | --- | --- |
| Roles | `super_admin`, `branch_staff` | Add `branch_admin` and its permissions |
| Product | Global, has `price` and `description` | Make it per-branch; remove price; add `default_unit`, `category`, `normalized_name` |
| Customer | Fields inline on `Order` | New `Customer` and `CustomerAddress` models |
| Order | No payment, total or number | Add `payment_method`, `total_amount`, `pays_with`, `number`, `cancel_reason`, address snapshot |
| OrderItem | `product` required, `unit_price` | Make `product` nullable; add `name_snapshot`, decimal `quantity`, `unit`, `notes`; remove price |
| Status audit | None | `OrderStatusEvent` |
| Real time | None | Channels + Redis + socket client |
| Excel import | None | Endpoint with preview and apply steps, plus a template |
| Frontend | Login only; other pages are stubs | All screens; theme and branding |
| Repo hygiene | Django code at the root, an empty `backend/`, no git, no tests | `git init`; move Django into `backend/`; add tests |

The data is still only seed data, so it is fine to **rewrite migrations** instead of migrating.

## 9. Milestones

1. **Foundation:** git, repo layout, PostgreSQL, the new models and migrations, the roles and permission matrix, and scoping tests.
2. **Catalog:** product CRUD, Excel import with preview, and product search.
3. **Create order:** the full create-order screen, customer lookup, free-text items and the draft autosave.
4. **Board and lifecycle:** the order board, status transitions, the detail and print view, and editing rules.
5. **Real time:** Channels, sound notifications and the polling fallback.
6. **Admin:** branch and user management, and order history with filters.
7. **Hardening and deploy:** choose hosting, Docker, HTTPS, backups, and a usability test with real staff.

## 10. Open questions

- Is there an SVG or high-resolution version of the logo?
- Should "Paga con" and the change due appear on the printed ticket for the driver?
- What is the retention policy for customer personal data under Habeas Data (Ley 1581 de 2012)? A privacy note is probably needed.
- Will product categories be used for browsing, or only for organizing the Excel file?
- Hosting provider and budget.
