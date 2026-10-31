# SunPower Solutions — Solar Installation Management System

An end-to-end operations platform for a rooftop solar business. It runs the full journey from a public website enquiry to a signed-off installation, payment collection, warranty start and after-sales support ticket — with role-specific dashboards for the director, sales office, technicians, warehouse and support desk.

Built as an npm-workspaces monorepo:

- **Web** — Next.js 16 (App Router), React 19, TypeScript, Mantine 9, TanStack Query, Axios, Lucide.
- **API** — Node.js 22, Fastify 5, TypeScript, Prisma 6, PostgreSQL, JWT + bcryptjs, Zod, Helmet, rate limiting, Pino.
- **Assets** — static Code 128 barcode SVGs per product/tool folder, generated with `bwip-js`; a static UPI QR generated with `qrcode`.

---

## What it does

### Public website
- Marketing landing page with packages, process, roles and an enquiry form.
- Enquiries are written straight into the sales pipeline as a `NEW` lead with a reference number.
- Public quote page at `/q/<token>`: itemised BOM, totals, accept quote, UPI QR, screenshot upload and live payment status.
- Customer portal at `/portal`: track orders by registered phone, see balance and installation date, raise a support ticket and confirm a repair.

### Sales & office
- Lead Kanban with verification, assignment, status moves and a new-lead modal.
- Lead detail: verification, survey scheduling and measurement approval, quote generation from an automatic BOM.
- Quote builder for **1–5 kW on-grid / off-grid** systems, with editable discount, printable quote, public link and accept/order creation.
- Payment approval queue: inspect the uploaded UPI screenshot, approve or reject. Approval flips the order to `ADVANCE_PAID` and creates the installation job automatically.
- Orders list and detail, schedule, support desk, subsidies and expense book.

### Warehouse
- Packing checklist per order with “pack all”, serial scanning for inverters, batteries and charge controllers, dispatch readiness and dispatch.
- Inventory summary by product, serial register, stock receiving, low-stock alerts and status changes.
- Barcode library grouped by category folder with download and copy-path actions.

### Technician
- “My day” schedule, job cards, clock in/out with time logs.
- Roof/finished photo upload, customer signature pad, completion notes and test result.
- Site balance collection with UPI QR and payment proof upload.
- Job completion starts the warranty automatically for every installed serial, creates the sales invoice and advances the subsidy record.

### Support
- Warranty/customer lookup by phone, name, serial, order or ticket number.
- Raise, assign, update and resolve tickets; warranty status is detected from the serial number.
- Billable repair charges, 18% GST invoice, payment recording and customer repair confirmation.
- Warranty-expiring units, ticket priorities and warranty mix.

### Director
- Revenue today / week / month, expenses, profit, receivables, pending installations, open and urgent tickets, technician hours, subsidy pipeline and conversion.
- Six-month revenue/expense/profit chart, lead funnel, job profitability, payment mix, recent collections, upcoming jobs and pending installs.

---

## Demo accounts

All demo users use the password **`SunPower@123`**.

| Role | Email | Home |
| --- | --- | --- |
| Director | `director@sunpower.in` | `/dashboard/director` |
| Sales & office | `sales@sunpower.in` | `/dashboard/sales` |
| Technician | `tech@sunpower.in` | `/dashboard/schedule` |
| Technician 2 | `tech2@sunpower.in` | `/dashboard/schedule` |
| Warehouse | `warehouse@sunpower.in` | `/dashboard/warehouse` |
| Support | `support@sunpower.in` | `/dashboard/support` |

Useful demo data:

- Public quotes: `/q/demo-meenakshi`, `/q/demo-david`, `/q/demo-pooja`, `/q/demo-lakshmi`, `/q/demo-arjun`, `/q/demo-naveen`, `/q/demo-kavita`, `/q/demo-ramesh`, `/q/demo-rohit`.
- Customer portal: phone `9876543218` (Lakshmi) or `9876543220` (Arjun).
- Warranty serials: `SN-INV-3K-STK-0001` (in warranty), `SN-INV-3K-STK-0002` (expired), `SN-INV-2K-STK-0001` (in warranty).
- Pending payment approvals, a warehouse queue, open/resolved tickets, historical jobs, expenses and subsidy records are seeded.

---

## Repository layout

```
.
├─ apps/
│  ├─ api/
│  │  ├─ prisma/            # schema + deterministic demo seed
│  │  ├─ src/
│  │  │  ├─ lib/            # env, prisma, auth, errors, files, multipart, sequences
│  │  │  ├─ routes/         # auth, public, leads, quotes, payments, orders, ...
│  │  │  ├─ services/       # BOM pricing, quote acceptance, tickets, warranty
│  │  │  ├─ app.ts          # Fastify app, plugins, RBAC decorators
│  │  │  └─ server.ts       # entrypoint
│  │  └─ uploads/           # runtime uploads (gitignored)
│  └─ web/
│     ├─ app/               # App Router pages (landing, login, dashboard, /q, /portal)
│     ├─ components/        # UI, dashboard shell, forms, charts, payment QR, signature pad
│     ├─ lib/               # API client, auth context, types, formatting
│     └─ public/
│        ├─ barcodes/       # generated Code 128 SVGs in category folders + manifest.json
│        ├─ payments/       # static UPI QR and upi.json
│        └─ demo/           # demo payment proof, roof photos, signature
├─ scripts/generate-assets.mjs
├─ docker-compose.yml       # local PostgreSQL 16
└─ package.json             # workspace scripts
```

---

## Quick start

### Prerequisites
- Node.js **22+**
- PostgreSQL **16+** (local install or Docker)
- npm 10+

### 1. Install

```bash
npm install
```

### 2. Start PostgreSQL

With Docker:

```bash
docker compose up -d db
```

Or use a local PostgreSQL and create the database:

```sql
CREATE DATABASE sunodoopower;
```

### 3. Configure environment

```bash
cp .env.example apps/api/.env
```

Edit `apps/api/.env` if your database credentials differ. Create `apps/web/.env.local`:

```bash
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_UPI_ID=sunpower@upi
NEXT_PUBLIC_UPI_NAME=SunPower Solutions
```

> `.env` and `.env.local` are gitignored. Never commit real secrets.

### 4. Create the schema, seed and assets

```bash
npm run db:generate
npm run db:push
npm run db:seed
npm run assets
```

Or all at once after `npm install`:

```bash
npm run setup
```

### 5. Run both apps

```bash
npm run dev
```

- Web: <http://localhost:3000>
- API: <http://localhost:4000>
- Health: <http://localhost:4000/api/health>

Production build:

```bash
npm run build
npm start
```

---

## Environment variables

### API (`apps/api/.env`)

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | JWT signing secret — change in production |
| `PORT` / `HOST` | API listen address (default `4000` / `0.0.0.0`) |
| `WEB_ORIGIN` | Allowed CORS origin (comma-separated supported) |
| `PUBLIC_API_URL` | Public base URL used for generated links |
| `UPLOAD_DIR` | Upload directory (default `./uploads`) |
| `UPI_ID` / `UPI_NAME` | Company UPI details used by the QR asset |

### Web (`apps/web/.env.local`)

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | API base URL, e.g. `http://localhost:4000` |
| `NEXT_PUBLIC_UPI_ID` | UPI ID shown on the payment QR |
| `NEXT_PUBLIC_UPI_NAME` | Payee name shown on the payment QR |

---

## Core workflow

```
Website enquiry
   ↓  lead NEW (assigned to sales)
Verification call
   ↓  VERIFIED
Survey scheduled → technician measures roof
   ↓  SURVEY_SCHEDULED → SURVEY_COMPLETED → survey approved
Auto-BOM quote (1–5 kW, on/off-grid)
   ↓  QUOTED / SENT (public token + printable quote)
Customer accepts on /q/<token>
   ↓  WON + order PENDING_PAYMENT
Advance or full payment
   ↓  UPI QR + screenshot → office approval → ADVANCE_PAID
Warehouse packing + serial scan
   ↓  READY_TO_DISPATCH → DISPATCHED (warranty start recorded)
Technician installation
   ↓  clock in/out, roof photos, signature, completion
   ↓  INSTALLED (warranty active, invoice + subsidy record)
Support & warranty
   ↓  ticket → diagnosis → repair → resolve → customer confirms → CLOSED
```

### Payments

- A single **static company UPI QR** is served from `apps/web/public/payments/upi-qr.svg`.
- The customer pays with any UPI app and uploads a screenshot on the public quote page or at the job card.
- Payments are created as `PENDING`; the office approves or rejects them from `/dashboard/payments`.
- Approval recalculates `advancePaid` / `balanceDue`, moves a pending order to `ADVANCE_PAID` and ensures an installation job exists.
- Screenshots are stored under `apps/api/uploads/` (gitignored) and served at `/uploads/...`.

### Money & tax

- All monetary values are stored as **integer INR** to avoid floating-point drift.
- BOM/quote arithmetic uses **Decimal.js**; the API returns rounded integers.
- Quotes use an 18% GST line; repair invoices use 18% GST; completion invoices use the configured effective rate.
- The director P&L derives parts cost from the BOM, labour from clocked hours and other cost from job expenses.

---

## Barcode assets

`scripts/generate-assets.mjs` reads `apps/api/src/catalog/products.json` and writes one **Code 128** SVG per SKU into its category folder under `apps/web/public/barcodes/`:

| Folder | Category | Labels |
| --- | --- | --- |
| `panels/` | PANEL | 1 |
| `inverters/` | INVERTER | 5 |
| `batteries/` | BATTERY | 2 |
| `charge-controllers/` | CHARGE_CONTROLLER | 1 |
| `structures/` | STRUCTURE | 5 |
| `cables/` | CABLE | 2 |
| `bos/` | BOS | 5 |
| `services/` | SERVICE | 3 |
| `tools/` | TOOL | 10 |

- `apps/web/public/barcodes/manifest.json` is the machine-readable index used by `/dashboard/barcodes`.
- `apps/web/public/barcodes/README.md` is generated with the folders and counts.
- The barcode library page lets staff preview, download and copy the public path for each label.
- Regenerate after changing the catalogue: `npm run assets`.

---

## Public routes

| Route | Purpose |
| --- | --- |
| `/` | Landing page + enquiry form |
| `/q/<token>` | Public quote, acceptance, UPI payment and screenshot upload |
| `/portal` | Customer order tracking, ticket raise and repair confirmation |
| `/login` | Staff sign-in |

---

## API overview

Base URL: `http://localhost:4000/api`. Protected routes require `Authorization: Bearer <JWT>`.

| Area | Endpoints |
| --- | --- |
| Auth | `POST /auth/login`, `GET /auth/me`, `GET /auth/users` |
| Public | `POST /public/inquiries`, `GET /public/quotes/:token`, `POST /public/quotes/:token/accept`, `POST /public/quotes/:token/payments`, `POST /public/tickets`, `POST /public/tickets/:ticketNumber/confirm`, `GET /public/track/:phone` |
| Leads & surveys | `GET/POST /leads`, `GET/PATCH /leads/:id`, `POST /leads/:id/verify`, `POST /leads/:id/survey`, `PATCH /leads/:id/survey`, `POST /leads/:id/survey/approve` |
| Quotes | `GET /quotes`, `GET /quotes/:id`, `POST /leads/:id/quotes`, `POST /quotes/:id/recalculate`, `PATCH /quotes/:id/status` |
| Payments | `GET /payments`, `POST /payments`, `POST /payments/:id/approve`, `POST /payments/:id/reject` |
| Orders | `GET /orders`, `GET /orders/:id`, `PATCH /orders/:orderId/kit/:itemId`, `POST /orders/:id/pack-all`, `POST /orders/:id/scan`, `POST /orders/:id/dispatch` |
| Inventory | `GET /inventory`, `GET /inventory/summary`, `GET /inventory/serials/:serial`, `POST /inventory`, `PATCH /inventory/:id/status` |
| Jobs | `GET /jobs`, `GET /jobs/:id`, `PATCH /jobs/:id`, `POST /jobs/:id/clock-in`, `POST /jobs/:id/clock-out`, `POST /jobs/:id/photos`, `POST /jobs/:id/signature`, `POST /jobs/:id/payments`, `POST /jobs/:id/complete` |
| Support | `GET /tickets`, `GET /tickets/:id`, `POST /tickets`, `PATCH /tickets/:id`, `POST /tickets/:id/updates`, `GET /support/lookup?q=` |
| Dashboards | `GET /dashboard/director`, `/sales`, `/technician`, `/warehouse`, `/support` |
| Catalogue | `GET /catalog`, `GET /products`, `POST /products`, `PATCH /products/:id` |
| Finance | `GET/POST /expenses`, `GET /subsidies`, `PATCH /subsidies/:id` |

Role checks are enforced server-side with Fastify `preHandler` guards (`authenticate` + `authorize(...)`); the UI navigation is filtered by role as well.

---

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Run API and web together with hot reload |
| `npm run build` | Generate Prisma client, build API and web |
| `npm start` | Run built API and web |
| `npm run db:generate` | Generate the Prisma client |
| `npm run db:push` | Push the schema to PostgreSQL (no migration files) |
| `npm run db:seed` | Reset and seed demo data |
| `npm run db:studio` | Open Prisma Studio |
| `npm run assets` | Regenerate barcode SVGs, manifest and UPI QR |
| `npm run typecheck` | Typecheck the web app |

The seed is deterministic and safe to re-run: it clears operational tables, then recreates users, catalogue, leads, historical orders/jobs, payments, tickets, expenses and subsidies.

---

## Production notes

- Use a managed PostgreSQL instance and set a strong `JWT_SECRET`.
- Set `WEB_ORIGIN` to the deployed web origin and `NEXT_PUBLIC_API_URL` to the public API URL.
- Serve uploaded files from persistent storage or an object store; the local `uploads/` folder is ephemeral on most PaaS hosts.
- The UPI QR is intentionally static (company-level). Replace `apps/web/public/payments/upi-qr.svg` and `upi.json` to change the payee; never commit real bank secrets.
- Run `npm run build` in CI, apply `npm run db:push` (or your migration workflow), then seed only demo environments.
- The API enables Helmet, CORS, rate limiting on public forms and Pino request logging.

---

## Verification checklist

The flows have been exercised end-to-end against the seeded database:

- Login for all six demo users and role-guarded dashboards.
- Lead list, quote list, payments, orders, jobs, tickets, support lookup, inventory, subsidies, expenses, catalogue.
- Public enquiry creating a sales lead.
- Public quote accept → order → screenshot upload → office approval → installation job.
- Warehouse pack-all → serial scan → dispatch.
- Technician clock in/out → roof photo → signature → completion → order `INSTALLED` with active warranties.
- Public ticket → support resolution → customer confirmation → ticket `CLOSED`.
- Customer portal reflecting the new order.
- `tsc --noEmit` for both apps and `next build` for the web app.

---

## License

Private project for SunPower Solutions. All rights reserved.
