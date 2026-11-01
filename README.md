# SunOdoo

An end-to-end enterprise resource planning system for rooftop solar companies. SunOdoo manages the complete business lifecycle — from customer enquiry and site survey through warehouse dispatch, field installation, and post-installation warranty support.

Built as a monorepo with a Next.js frontend and Fastify API backend, backed by PostgreSQL.

---

## Table of Contents

- [Why SunOdoo](#why-sunodoo)
- [Architecture](#architecture)
- [Entity-Relationship Model](#entity-relationship-model)
- [Business Lifecycle](#business-lifecycle)
- [Role-Based Dashboards](#role-based-dashboards)
- [Mobile-First Field Operations](#mobile-first-field-operations)
- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Demo Accounts](#demo-accounts)
- [API Reference](#api-reference)
- [Project Structure](#project-structure)
- [License](#license)

---

## Why SunOdoo

Rooftop solar operations have specific requirements that generic ERP systems don't address well:

- **Field work on rooftops** — technicians can't carry laptops to elevated, sloped surfaces. They need a fully functional mobile interface for surveys, installations, diagnostics, and sign-offs.
- **Complex quoting** — Bills of Material (BOM) vary by system capacity (1–5 kW), type (on-grid / off-grid), and require accurate GST computation and government subsidy projections.
- **Serialized asset tracking** — high-value inverters, panels, and batteries need barcode-based serial tracking with warranty dates tied to installation sign-off.
- **Closed-loop warranty support** — when a customer reports a breakdown, the system must look up their hardware serial numbers, determine warranty status, and generate the correct invoice (zero-cost warranty or billable repair with GST).

SunOdoo handles all of this in a single system with role-specific interfaces for directors, sales staff, warehouse officers, field technicians, and support agents.

---

## Architecture

```
SunOdoo Monorepo
├── apps/web ──── Next.js 16 (App Router, React 19, Mantine UI)
│                 Role-gated dashboards, public customer portal,
│                 responsive mobile interface for field operations
│
├── apps/api ──── Fastify 5 (TypeScript, Prisma ORM, Zod validation)
│                 RESTful API with JWT auth, RBAC middleware,
│                 structured audit logging via Pino
│
└── PostgreSQL 16
                  21 tables, 18 enums, full relational integrity
                  with composite indexes on high-query columns
```

All monetary values are stored as integers (INR) to avoid floating-point rounding. Tax calculations use precise decimal arithmetic.

---

## Entity-Relationship Model

The full relational schema, implemented via Prisma ORM on PostgreSQL:

```mermaid
erDiagram
    USER ||--o{ LEAD : "assigned to"
    USER ||--o{ SURVEY : "conducts"
    USER ||--o{ QUOTE : "creates"
    USER ||--o{ ORDER : "approves"
    USER ||--o{ JOB : "assigned as technician"
    USER ||--o{ TICKET : "assigned to resolve"
    USER ||--o{ INVOICE : "creates"
    USER ||--o{ EXPENSE : "records"
    USER ||--o{ AUDIT_LOG : "triggers"

    CUSTOMER ||--o{ LEAD : "initiates"
    CUSTOMER ||--o{ QUOTE : "receives"
    CUSTOMER ||--o{ ORDER : "places"
    CUSTOMER ||--o{ JOB : "hosts on-site"
    CUSTOMER ||--o{ TICKET : "reports issue"
    CUSTOMER ||--o{ INVOICE : "billed to"
    CUSTOMER ||--o{ SUBSIDY_RECORD : "claims"

    LEAD ||--o| SURVEY : "requires"
    LEAD ||--o{ QUOTE : "generates"
    LEAD ||--o{ ORDER : "converts to"
    LEAD ||--o{ JOB : "schedules survey for"

    QUOTE ||--|{ QUOTE_ITEM : "contains"
    QUOTE ||--o| ORDER : "accepted into"
    PRODUCT ||--o{ QUOTE_ITEM : "referenced in"

    ORDER ||--o{ KIT_ITEM : "reserves hardware"
    ORDER ||--o{ INVENTORY_UNIT : "allocates serials"
    ORDER ||--o{ PAYMENT : "collects"
    ORDER ||--o| JOB : "requires installation"
    ORDER ||--o| INVOICE : "generates sales invoice"
    ORDER ||--o| SUBSIDY_RECORD : "submits subsidy"

    PRODUCT ||--o{ KIT_ITEM : "specifies"
    PRODUCT ||--o{ INVENTORY_UNIT : "tracked as"
    PRODUCT ||--o{ TICKET : "reported against"

    JOB ||--o{ JOB_PHOTO : "documented by"
    JOB ||--o| JOB_SIGNATURE : "signed off"
    JOB ||--o{ TIME_LOG : "time tracked"
    JOB ||--o{ EXPENSE : "incurs"

    TICKET ||--o{ TICKET_UPDATE : "status history"
    TICKET ||--o{ JOB : "dispatches repair"
    TICKET ||--o| INVOICE : "generates service invoice"
    TICKET ||--o{ PAYMENT : "collects"
    INVENTORY_UNIT ||--o{ TICKET : "warranty checked"

    USER {
        string id PK
        string name
        string email UK
        string passwordHash
        enum role "DIRECTOR | SALES | TECHNICIAN | WAREHOUSE | SUPPORT"
        string phone
        boolean active
    }

    CUSTOMER {
        string id PK
        string name
        string phone UK
        string email
        string address
        string city
        int monthlyBill
        int roofAreaSqft
    }

    LEAD {
        string id PK
        string reference UK
        string customerId FK
        enum source "WEB_FORM | WHATSAPP | PHONE | WALK_IN"
        float requestedKw
        enum systemType "ON_GRID | OFF_GRID"
        enum status "NEW > VERIFIED > SURVEY_SCHEDULED > QUOTED > WON | LOST"
        string assignedToId FK
    }

    SURVEY {
        string id PK
        string leadId FK_UK
        string technicianId FK
        string roofDirection
        int tiltDegrees
        int shadowFreeAreaSqft
        boolean approved
        string technicianAssessment "FEASIBLE | NOT_FEASIBLE"
    }

    QUOTE {
        string id PK
        string quoteNumber UK
        string leadId FK
        string customerId FK
        float capacityKw
        int subtotal
        float discountPercent
        int taxAmount
        int total
        enum status "DRAFT | SENT | ACCEPTED | REJECTED | EXPIRED"
        string publicToken UK
    }

    QUOTE_ITEM {
        string id PK
        string quoteId FK
        string productId FK
        enum category "PANEL | INVERTER | BATTERY | CABLE | BOS | ..."
        int quantity
        int unitPrice
        int total
    }

    PRODUCT {
        string id PK
        string sku UK
        string name
        enum category "PANEL | INVERTER | BATTERY | STRUCTURE | CABLE | BOS"
        int unitPrice
        int costPrice
        int warrantyMonths
        string barcodePath
    }

    ORDER {
        string id PK
        string orderNumber UK
        string quoteId FK_UK
        string customerId FK
        enum status "PENDING_PAYMENT > ADVANCE_PAID > DISPATCHED > INSTALLED > COMPLETED"
        int total
        int advancePaid
        int balanceDue
        datetime dispatchAt
        datetime installedAt
    }

    KIT_ITEM {
        string id PK
        string orderId FK
        string productId FK
        int quantity
        boolean packed
        datetime packedAt
    }

    INVENTORY_UNIT {
        string id PK
        string productId FK
        string serialNumber UK
        enum status "IN_STOCK | RESERVED | DISPATCHED | INSTALLED | FAULTY"
        string orderId FK
        datetime warrantyStart
        datetime warrantyEnd
    }

    PAYMENT {
        string id PK
        string orderId FK
        string ticketId FK
        int amount
        enum method "UPI | CASH | BANK_TRANSFER | CARD | CHEQUE"
        enum type "ADVANCE | BALANCE | FULL"
        enum status "PENDING | APPROVED | REJECTED"
        string screenshotUrl
    }

    JOB {
        string id PK
        string jobNumber UK
        string orderId FK_UK
        string ticketId FK
        string customerId FK
        enum type "SURVEY | INSTALLATION | REPAIR"
        enum status "SCHEDULED | IN_PROGRESS | COMPLETED | CANCELLED"
        string technicianId FK
        datetime scheduledDate
        datetime clockInAt
        datetime clockOutAt
        float hoursWorked
    }

    JOB_PHOTO {
        string id PK
        string jobId FK
        string url
        string caption
    }

    JOB_SIGNATURE {
        string id PK
        string jobId FK_UK
        string signerName
        string dataUrl
        datetime signedAt
    }

    TIME_LOG {
        string id PK
        string jobId FK
        string userId FK
        datetime clockIn
        datetime clockOut
        int minutes
    }

    TICKET {
        string id PK
        string ticketNumber UK
        string customerId FK
        string orderId FK
        string serialNumber
        string issue
        enum priority "LOW | MEDIUM | HIGH | URGENT"
        enum status "OPEN | IN_PROGRESS | RESOLVED | CLOSED"
        enum warrantyStatus "IN_WARRANTY | OUT_OF_WARRANTY | UNKNOWN"
        boolean billable
        int laborCharge
        int partsCharge
        int totalCharge
    }

    TICKET_UPDATE {
        string id PK
        string ticketId FK
        string authorId FK
        string message
        string statusFrom
        string statusTo
    }

    INVOICE {
        string id PK
        string invoiceNumber UK
        string customerId FK
        string orderId FK_UK
        string ticketId FK_UK
        enum type "SALES | REPAIR"
        int subtotal
        float taxRate
        int taxAmount
        int total
        enum status "DRAFT | SENT | PAID | OVERDUE"
    }

    EXPENSE {
        string id PK
        string category
        string description
        int amount
        string jobId FK
    }

    SUBSIDY_RECORD {
        string id PK
        string customerId FK
        string orderId FK_UK
        string scheme
        enum status "NOT_STARTED | SUBMITTED | APPROVED | DISBURSED"
        int amount
        string applicationNumber
    }

    AUDIT_LOG {
        string id PK
        string userId FK
        string action
        string entity
        string entityId
        json meta
        datetime createdAt
    }
```

---

## Business Lifecycle

The system models a linear progression from initial enquiry to post-installation support:

```mermaid
flowchart LR
    A["Enquiry"] --> B["Lead"]
    B --> C["Site Survey"]
    C --> D["Quote + BOM"]
    D --> E["Order + Payment"]
    E --> F["Warehouse Pack & Dispatch"]
    F --> G["Field Installation"]
    G --> H["Warranty Activation + Invoice"]
    H --> I["Support Ticket"]
    I --> J["Repair Job"]
    J --> K["Service Invoice"]
```

**Enquiry → Lead:** Public website form or walk-in creates a customer record and lead entry. Sales assigns and verifies.

**Site Survey:** Technician visits the roof, records tilt angle, shadow-free area, cable distance, and feasibility assessment. Sales can override an unfeasible assessment with justification.

**Quote + BOM:** The system auto-generates a Bill of Materials based on capacity (1–5 kW) and system type (on-grid/off-grid). Includes panels, inverter, structure, cables, and balance-of-system components. Applies 18% GST and computes PM Surya Ghar subsidy eligibility. A public link (`/q/:token`) lets the customer review, accept, and pay advance via UPI QR.

**Order + Payment:** Accepted quote becomes an order. Sales verifies payment screenshots. Payment status drives order progression.

**Warehouse:** Kit items are packed against a checklist. Each serialized unit (inverter, battery) is scanned via Code 128 barcode and linked to the order. Dispatch triggers warranty start date.

**Field Installation:** Technician clocks in, uploads photo evidence of the installation, captures customer signature on a touch canvas, and completes the job. Hours worked are computed from clock-in/clock-out.

**Warranty + Invoice:** Order is marked complete. A sales invoice is generated. Warranty period begins from the installation date for all serialized units.

**Support:** Customer reports a breakdown via public form or helpline. System auto-looks up their serial numbers and warranty dates. Support agent approves either a free warranty repair (₹0 invoice) or a billable repair. Technician is dispatched for on-site diagnosis and repair. A service invoice (`SP-INV-YYYY-XXXX`) is generated on completion.

---

## Role-Based Dashboards

| Role | Path | Capabilities |
|:--|:--|:--|
| Director | `/dashboard/director` | P&L overview, gross margins, lead conversion rates, overdue collections, subsidy pipeline, technician utilization |
| Sales | `/dashboard/sales` | Lead kanban board, BOM quote generator, public quote links, UPI payment verification queue |
| Technician | `/dashboard/schedule` | Daily schedule, job cards, GPS clock-in, photo uploads, touch signature, mobile diagnostics |
| Warehouse | `/dashboard/warehouse` | Order packing checklists, barcode scanning, serial tracking, dispatch verification |
| Support | `/dashboard/support` | Ticket intake, warranty lookup, repair approval, service invoicing, customer communication |
| Customer | `/portal`, `/q/:token` | Order tracking (by phone), quote acceptance, UPI payment, breakdown reporting |

---

## Mobile-First Field Operations

SunOdoo was built with responsive design specifically for technicians who cannot carry laptops to site visits. Every field-facing screen works on a smartphone:

- **Clock-in / clock-out** — one-tap time tracking with automatic hours computation
- **Camera integration** — direct photo capture of roof conditions, installed hardware, and wiring; attached to the job card
- **Touch signature** — HTML5 canvas for customer sign-off on any screen size
- **On-site diagnostics** — two-mode inspection: immediate repair (set budget and labor charges) or replacement recommendation (select OEM part, fault code, quote)
- **Service billing** — invoice generated on job completion; warranty repairs show ₹0, billable repairs itemize parts + labor + 18% GST

All field data syncs to the back office in real time.

---

## Tech Stack

### Frontend

| Component | Version | Purpose |
|:--|:--|:--|
| Next.js | 16 | App Router with Turbopack |
| React | 19 | UI rendering |
| TypeScript | 5.7 | Strict mode, full type coverage |
| Mantine | 7 | Component library and theming |
| TanStack Query | 5 | Server state management and caching |
| Axios | — | HTTP client |
| Lucide | — | Icon set |

### Backend

| Component | Version | Purpose |
|:--|:--|:--|
| Node.js | 22 | Runtime |
| Fastify | 5 | HTTP framework |
| TypeScript | 5.7 | Strict mode |
| Prisma | 6 | ORM and query builder |
| PostgreSQL | 16 | Relational database |
| Zod | — | Request validation |
| JWT + bcryptjs | — | Authentication |
| Helmet | — | Security headers |
| Pino | — | Structured JSON logging |
| bwip-js | — | Code 128 barcode SVG generation |
| qrcode | — | UPI QR code generation |

---

## Getting Started

### Prerequisites

- Node.js 22+
- PostgreSQL 16+
- npm 10+

### 1. Clone and install

```bash
git clone https://github.com/rohitsagar9/SunOdoo.git
cd SunOdoo
npm install
```

### 2. Configure environment

**`apps/api/.env`**

```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sunodoopower?schema=public"
JWT_SECRET="your-jwt-secret"
PORT=4000
HOST="0.0.0.0"
WEB_ORIGIN="http://localhost:3000"
PUBLIC_API_URL="http://localhost:4000/api"
UPLOAD_DIR="./uploads"
UPI_ID="your-upi-id@upi"
UPI_NAME="Your Business Name"
```

**`apps/web/.env.local`**

```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_UPI_ID="your-upi-id@upi"
NEXT_PUBLIC_UPI_NAME="Your Business Name"
```

### 3. Initialize database

```bash
npm run db:push       # Apply Prisma schema to PostgreSQL
npm run db:seed       # Seed demo data (customers, leads, quotes, orders, inventory)
npm run assets        # Generate Code 128 barcode SVGs
```

### 4. Start development servers

```bash
npm run dev
```

| Service | URL |
|:--|:--|
| Web application | http://localhost:3000 |
| API server | http://localhost:4000 |
| Health check | http://localhost:4000/api/health |

---

## Demo Accounts

All demo accounts use the password `SunPower@123`.

| Role | Email | Dashboard |
|:--|:--|:--|
| Director | `director@sunpower.in` | `/dashboard/director` |
| Sales | `sales@sunpower.in` | `/dashboard/sales` |
| Technician | `tech@sunpower.in` | `/dashboard/schedule` |
| Warehouse | `warehouse@sunpower.in` | `/dashboard/warehouse` |
| Support | `support@sunpower.in` | `/dashboard/support` |

**Public pages:**

- Quote acceptance: [`/q/demo-meenakshi`](http://localhost:3000/q/demo-meenakshi), [`/q/demo-naveen`](http://localhost:3000/q/demo-naveen)
- Customer portal: [`/portal`](http://localhost:3000/portal) (use phone `9876543210` or `9876543218`)
- Support form: [`/#support`](http://localhost:3000/#support)

---

## API Reference

Base URL: `http://localhost:4000/api`
Authentication: `Authorization: Bearer <JWT>` (except public endpoints)

### Authentication

| Method | Endpoint | Description |
|:--|:--|:--|
| `POST` | `/auth/login` | Authenticate and receive JWT |
| `GET` | `/auth/me` | Current user profile |
| `GET` | `/auth/users` | List staff by role |

### Public

| Method | Endpoint | Description |
|:--|:--|:--|
| `POST` | `/public/inquiries` | Submit solar enquiry |
| `POST` | `/public/support-ticket` | Report breakdown (auto warranty check) |
| `GET` | `/public/quotes/:token` | View quote by public token |
| `POST` | `/public/quotes/:token/accept` | Accept quote |
| `POST` | `/public/quotes/:token/payments` | Upload payment proof |
| `GET` | `/public/track/:phone` | Customer order tracking |

### Leads & Surveys

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET/POST` | `/leads` | List or create leads |
| `POST` | `/leads/:id/verify` | Mark lead as verified |
| `POST` | `/leads/:id/survey` | Schedule site survey |

### Quotes

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET/POST` | `/quotes` | List or create BOM quotes |

### Orders

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET` | `/orders` | List orders by status |
| `POST` | `/orders/:id/pack-all` | Batch pack kit items |
| `POST` | `/orders/:id/scan` | Validate serial against order |
| `POST` | `/orders/:id/dispatch` | Confirm dispatch |

### Jobs

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET` | `/jobs` | List jobs by date, role, status |
| `POST` | `/jobs/:id/clock-in` | Start time tracking |
| `POST` | `/jobs/:id/photos` | Upload site photos |
| `POST` | `/jobs/:id/signature` | Capture customer signature |
| `POST` | `/jobs/:id/submit-inspection` | Submit diagnostic report |
| `POST` | `/jobs/:id/complete` | Complete job and generate invoice |

### Support & Warranty

| Method | Endpoint | Description |
|:--|:--|:--|
| `GET/POST` | `/tickets` | Ticket lifecycle management |
| `POST` | `/tickets/:id/approve-repair` | Approve warranty or billable repair |
| `POST` | `/tickets/:id/generate-bill` | Generate service invoice |
| `GET` | `/support/lookup` | Search by phone, serial, or order |

---

## Project Structure

```
SunOdoo/
├── apps/
│   ├── api/                          # Fastify REST API
│   │   ├── prisma/
│   │   │   ├── schema.prisma        # Database schema (21 models, 18 enums)
│   │   │   ├── seed.ts              # Demo data seeder
│   │   │   └── seed-more-data.ts    # Volume test data
│   │   └── src/
│   │       ├── catalog/             # Product specifications and SKUs
│   │       ├── lib/                 # Auth, audit logger, sequence generator
│   │       ├── routes/              # Route handlers
│   │       ├── services/            # BOM engine, warranty checker, invoicing
│   │       └── types/               # Shared TypeScript types
│   │
│   └── web/                          # Next.js frontend
│       ├── app/
│       │   ├── dashboard/           # Role-gated dashboards
│       │   ├── portal/              # Public customer tracker
│       │   └── q/[token]/           # Public quote acceptance
│       ├── components/              # Invoice modal, signature pad, shared UI
│       └── public/                  # Barcode SVGs, UPI QR assets
│
├── scripts/
│   ├── generate-assets.mjs          # Code 128 barcode generator
│   ├── export_logs.mjs              # Audit trail export
│   └── verify_customer_journey.mjs  # End-to-end integration test
│
├── LOGS.md                           # Platform audit trail (550+ events)
└── package.json                      # Monorepo workspace config
```

---

## License

Copyright 2026 SunOdoo. All rights reserved.
