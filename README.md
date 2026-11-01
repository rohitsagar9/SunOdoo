# ☀️ SunOdoo™ — Solar Enterprise Resource Planning & Field Mobility System

<div align="center">

![Next.js 16](https://img.shields.io/badge/Next.js%2016-Turbopack-black?style=for-the-badge&logo=next.js)
![React 19](https://img.shields.io/badge/React%2019-Modern%20UI-blue?style=for-the-badge&logo=react)
![Fastify 5](https://img.shields.io/badge/Fastify%205-Ultra--Fast%20API-000000?style=for-the-badge&logo=fastify)
![Prisma 6](https://img.shields.io/badge/Prisma%206-Type--Safe%20ORM-2D3748?style=for-the-badge&logo=prisma)
![PostgreSQL 16](https://img.shields.io/badge/PostgreSQL%2016-Relational%20DB-336791?style=for-the-badge&logo=postgresql)
![TypeScript](https://img.shields.io/badge/TypeScript%205.7-Strict%20Mode-3178C6?style=for-the-badge&logo=typescript)
![Mobile PWA](https://img.shields.io/badge/Field%20Engineering-Mobile--First%20PWA-10B981?style=for-the-badge&logo=pwa)

**The unified operations platform for rooftop solar engineering companies.**  
*Bridging public enquiries, automated BOM calculation, warehouse barcode tracking, mobile field installations, and 24/7 SolarCare™ closed-loop warranty repairs.*

[Explore Architecture](#-system-architecture) • [ER Database Model](#-entity-relationship-model-er-diagram) • [Field Mobility Engine](#-mobile-first-field-technician-engine) • [Live Demo Credentials](#-demo-accounts--pre-seeded-scenarios) • [Quickstart Guide](#-quick-start)

---

</div>

## 📌 Executive Overview & Core Problem Solved

Rooftop solar companies face operational friction at every stage of their workflow:
1. **Field Fragility:** Technicians cannot safely handle heavy laptops on elevated, sloped tin/concrete roofs. Traditional ERPs lack mobile-first responsiveness, offline capability, and digital signature sign-offs.
2. **Disconnected Quoting:** Sales teams waste hours manually computing Bills of Materials (BOMs), solar panel wattages, inverter ratings, cables, and GST brackets.
3. **Inventory & Serial Leaks:** High-value inverters and lithium batteries leave warehouses without serialized barcodes or linked warranty start dates.
4. **Post-Installation Support Gaps:** Customers facing system breakdowns wait weeks for repairs with no visibility into warranty coverage or repair billing.

**SunOdoo™** resolves this with an **end-to-end, single-source-of-truth solar operating system**:
- 📱 **Zero-Laptop Mobile PWA:** Technicians execute surveys, logistics pickups, installation sign-offs, photo proofs, and diagnostics entirely from their smartphones.
- ⚡ **Dynamic Instant BOM Engine:** Auto-sizes 1–5 kW on-grid and off-grid solar plants with live 18% GST and PM Surya Ghar subsidy projections.
- 📦 **Serialized Hardware Traceability:** Code 128 barcode generation, camera scanner validation, and automatic warranty provisioning upon site sign-off.
- 🛠️ **SolarCare™ Breakdown Desk:** Public issue intake with instant warranty check, mobile technician fault isolation, 1-click free warranty approval, and automated Service Tax Invoicing (`SP-INV-2026-XXXX`).
- 📊 **C-Suite Financial Command Center:** Real-time Director P&L, gross margins, aging receivables, and lead-to-installation conversion analytics.

---

## 🔄 End-to-End Solar Lifecycle Flow

The diagram below illustrates the unbroken lifecycle from public enquiry to post-warranty support:

```mermaid
flowchart TD
    classDef startEnd fill:#f59e0b,stroke:#d97706,stroke-width:2px,color:#fff;
    classDef sales fill:#3b82f6,stroke:#1d4ed8,stroke-width:2px,color:#fff;
    classDef tech fill:#10b981,stroke:#047857,stroke-width:2px,color:#fff;
    classDef wh fill:#8b5cf6,stroke:#6d28d9,stroke-width:2px,color:#fff;
    classDef support fill:#ec4899,stroke:#be185d,stroke-width:2px,color:#fff;

    A["🌐 Public Website Enquiry\n(Landing Page Form)"]:::startEnd --> B["📋 Sales Pipeline Lead\n(NEW / VERIFIED)"]:::sales
    B --> C["📐 Roof Feasibility Survey\n(Mobile Measurement & Shadow Check)"]:::tech
    C --> D["⚡ Automated BOM Quotation\n(1-5 kW On/Off-Grid + 18% GST)"]:::sales
    D --> E["🔗 Public Quote Acceptance\n(/q/:token + Advance UPI QR)"]:::sales
    E --> F["🏦 Office Payment Verification\n(Order Confirmed & Kit Created)"]:::sales
    F --> G["📦 Warehouse Serialized Packing\n(Code 128 Scan & Dispatch)"]:::wh
    G --> H["🚚 Technician Field Installation\n(Clock In, Photo Proof, Canvas Signature)"]:::tech
    H --> I["📜 10-Yr Warranty Start & Sales Invoice\n(Order COMPLETED + Subsidy Tracking)"]:::wh
    I --> J["🚨 SolarCare™ Breakdown Report\n(Public Issue Form / Helpline)"]:::support
    J --> K["🔍 Mobile Fault Diagnostic\n(Option 1 Repair vs. Option 2 Replacement)"]:::tech
    K --> L["🛡️ Support Desk Warranty Evaluation\n(Auto-Approve ₹0 Free Warranty)"]:::support
    L --> M["🔧 On-Site Mobile Repair & Sign-off\n(Customer Signature + Photo Evidence)"]:::tech
    M --> N["🧾 Automated Service Tax Invoice\n(SP-INV-2026-XXXX + Closed-Loop Resolution)"]:::startEnd
```

---

## 🗄️ Entity-Relationship Model (ER Diagram)

The following Mermaid ER model maps the complete relational schema implemented across PostgreSQL and Prisma ORM:

```mermaid
erDiagram
    USER ||--o{ LEAD : "assigned_to"
    USER ||--o{ SURVEY : "conducts"
    USER ||--o{ QUOTE : "creates"
    USER ||--o{ ORDER : "approves"
    USER ||--o{ PAYMENT : "reviews"
    USER ||--o{ JOB : "executes"
    USER ||--o{ TICKET : "resolves"
    USER ||--o{ INVOICE : "authors"
    USER ||--o{ EXPENSE : "records"
    USER ||--o{ AUDIT_LOG : "triggers"

    CUSTOMER ||--o{ LEAD : "initiates"
    CUSTOMER ||--o{ QUOTE : "receives"
    CUSTOMER ||--o{ ORDER : "places"
    CUSTOMER ||--o{ JOB : "hosts"
    CUSTOMER ||--o{ TICKET : "reports"
    CUSTOMER ||--o{ INVOICE : "billed_to"
    CUSTOMER ||--o{ SUBSIDY_RECORD : "claims"

    LEAD ||--o| SURVEY : "requires"
    LEAD ||--o{ QUOTE : "generates"
    LEAD ||--o{ ORDER : "converts_to"
    LEAD ||--o{ JOB : "schedules_survey"

    SURVEY }o--|| USER : "inspected_by"

    QUOTE ||--|{ QUOTE_ITEM : "contains"
    QUOTE ||--o| ORDER : "establishes"
    PRODUCT ||--o{ QUOTE_ITEM : "referenced_in"

    ORDER ||--o{ ORDER_KIT_ITEM : "reserves"
    ORDER ||--o{ INVENTORY_UNIT : "allocates"
    ORDER ||--o{ PAYMENT : "collects"
    ORDER ||--o| JOB : "requires_install"
    ORDER ||--o| INVOICE : "generates"
    ORDER ||--o| SUBSIDY_RECORD : "submits"

    PRODUCT ||--o{ ORDER_KIT_ITEM : "specifies"
    PRODUCT ||--o{ INVENTORY_UNIT : "manufactures"
    PRODUCT ||--o{ TICKET : "affects"

    JOB ||--o{ JOB_PHOTO : "documents"
    JOB ||--o| JOB_SIGNATURE : "authenticates"
    JOB ||--o{ TIME_LOG : "measures"
    JOB ||--o{ EXPENSE : "incurs"

    TICKET ||--o{ TICKET_UPDATE : "tracks"
    TICKET ||--o{ JOB : "dispatches_service"
    TICKET ||--o| INVOICE : "bills_service"
    TICKET ||--o{ PAYMENT : "receives"
    INVENTORY_UNIT ||--o{ TICKET : "verified_under"

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
        string source
        float requestedKw
        string systemType
        string status
        string assignedToId FK
        string lostReason
    }

    SURVEY {
        string id PK
        string leadId FK
        string technicianId FK
        string roofDirection
        int tiltDegrees
        int shadowFreeAreaSqft
        boolean approved
        string technicianAssessment
        string findings
    }

    QUOTE {
        string id PK
        string quoteNumber UK
        string leadId FK
        string customerId FK
        float capacityKw
        int subtotal
        float discountPercent
        int discount
        float taxRate
        int taxAmount
        int total
        string status
        string publicToken UK
        int advanceAmount
    }

    QUOTE_ITEM {
        string id PK
        string quoteId FK
        string productId FK
        string category
        int quantity
        int unitPrice
        int total
    }

    PRODUCT {
        string id PK
        string sku UK
        string name
        string category
        int unitPrice
        int costPrice
        int warrantyMonths
        string barcodePath
    }

    ORDER {
        string id PK
        string orderNumber UK
        string quoteId FK
        string customerId FK
        string status
        int total
        int advancePaid
        int balanceDue
        datetime dispatchAt
        datetime installedAt
    }

    ORDER_KIT_ITEM {
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
        string status
        string warehouseLocation
        string orderId FK
        datetime warrantyStart
        datetime warrantyEnd
    }

    PAYMENT {
        string id PK
        string orderId FK
        string ticketId FK
        int amount
        string method
        string type
        string status
        string screenshotUrl
        string reference
        string approvedById FK
    }

    JOB {
        string id PK
        string jobNumber UK
        string orderId FK
        string ticketId FK
        string customerId FK
        string type
        string status
        string technicianId FK
        datetime scheduledDate
        datetime clockInAt
        datetime clockOutAt
        float hoursWorked
        string completionNotes
    }

    JOB_PHOTO {
        string id PK
        string jobId FK
        string url
        string caption
        datetime createdAt
    }

    JOB_SIGNATURE {
        string id PK
        string jobId UK
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
        string priority
        string status
        string warrantyStatus
        boolean billable
        int laborCharge
        int partsCharge
        int totalCharge
        string inspectionOutcome
        string replacementPart
    }

    TICKET_UPDATE {
        string id PK
        string ticketId FK
        string authorId FK
        string message
        string statusFrom
        string statusTo
        datetime createdAt
    }

    INVOICE {
        string id PK
        string invoiceNumber UK
        string customerId FK
        string orderId UK
        string ticketId UK
        string type
        int subtotal
        float taxRate
        int taxAmount
        int total
        string status
        datetime paidAt
    }

    EXPENSE {
        string id PK
        string category
        string description
        int amount
        string jobId FK
        datetime date
    }

    SUBSIDY_RECORD {
        string id PK
        string customerId FK
        string orderId UK
        string scheme
        string status
        int amount
        string applicationNumber
        datetime approvedAt
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

## 📱 Mobile-First Field Technician Engine

Field technicians are the frontline of every solar enterprise. SunOdoo is built with an **exclusive mobile experience**:

<table>
<tr>
<td width="50%">

### 1. Geolocation & Time Tracking
- **One-Tap Clock-In:** Logs GPS timestamp, active task, and technician credentials.
- **Automated Hours Computation:** Calculates total hours worked, feeding directly into job profitability and Director labor costing.

### 2. On-Site Proof & Touch Canvas
- **Direct Camera Photo Capture:** Eliminates offline photo transfers; attaches geotagged roof, inverter, and wiring photos directly to the job card.
- **Touchscreen Customer Signature:** Responsive HTML5 canvas lets customers sign off with their finger on any smartphone screen before work completion.

</td>
<td width="50%">

### 3. On-Site Diagnostics & Quoting
- **Dual-Mode Inspection:** Select between:
  - *Option 1 (On-Site Repair):* Set immediate repair budget and labor charges.
  - *Option 2 (Replacement Recommendation):* Select OEM replacement part, fault reason, and quote amount.
- **Zero-Laptop Freedom:** All diagnostic records sync directly to the Support Desk in real time.

### 4. Instant On-Site Service Billing
- **Automated Tax Invoicing:** Generates `SP-INV-2026-XXXX` upon completion.
- **Warranty Detection:** Automatically renders **₹0 Paid** for active warranty claims or itemizes parts, labor, and 18% GST.
- **Client Receipt Modal:** Allows instant printing or PDF receipt downloading on site.

</td>
</tr>
</table>

---

## 🏢 Role-Based Enterprise Modules

SunOdoo delivers dedicated interfaces customized for each role in a solar business:

| Role | Dashboard URL | Key Capabilities |
| :--- | :--- | :--- |
| **Executive Director** | `/dashboard/director` | Real-time P&L, monthly gross margins, technician labor utilization, overdue collections, PM Surya Ghar subsidy pipeline, and conversion funnels. |
| **Sales & Office Desk** | `/dashboard/sales` | Visual Lead Kanban, automated 1–5 kW BOM calculator, instant public quote generation (`/q/:token`), UPI payment verification queue. |
| **Field Technician** | `/dashboard/schedule` | "My Day" route schedule, job cards, GPS clock-in, touch signature pad, photo upload proofs, mobile diagnostics, on-site service bills. |
| **Warehouse Officer** | `/dashboard/warehouse` | Order packing checklists, Code 128 barcode scanning, serialized inventory tracking, restock requests, dispatch verification. |
| **Support Helpdesk** | `/dashboard/support` | 24/7 SolarCare™ intake, warranty serial lookup, 1-click ₹0 warranty repair approvals, repair tax invoicing, customer feedback tracker. |
| **Customer Portal** | `/portal` & `/q/:token` | Track installation progress by phone number, interactive quote acceptance, UPI QR code payment, and breakdown ticket reporting. |

---

## 🛠️ Technology Stack & Architecture

```
                                  SUNODOO MONOREPO
   ┌─────────────────────────────────────┴─────────────────────────────────────┐
   │                                                                           │
   ▼                                                                           ▼
[apps/web] — Next.js 16 Web & PWA                           [apps/api] — Fastify 5 Micro-Service
├── App Router (Turbopack Powered)                          ├── High-throughput async routing
├── React 19 + TypeScript Strict                            ├── Zod input validation pipelines
├── Mantine UI v7 Component Library                         ├── Prisma ORM 6 query builder
├── TanStack Query v5 (React Query)                         ├── PostgreSQL 16 relational storage
├── HTML5 Touch Signature Pad Canvas                        ├── JWT Authentication & RBAC guards
├── Responsive Camera Media Uploads                         ├── Helmet, CORS & Rate Limiting
└── Static Code 128 Barcode Engine                          └── Pino JSON structured audit logging
```

### 1. Integer Financial Integrity
All monetary values across quotes, orders, inventory, and payments are stored as **64-bit integer INR paise / rupees** to eliminate floating-point rounding errors. Arithmetic computations utilize `decimal.js` for tax compliance.

### 2. Comprehensive System Audit Trail
Every user action (`LOGIN`, `TICKET_CREATED`, `SURVEY_NOT_FEASIBLE`, `ORDER_DISPATCHED`, `JOB_COMPLETED`, `INVOICE_GENERATED`) is permanently committed to the `AuditLog` table with timestamp, user ID, entity ID, and JSON metadata. Over 550+ verified events are cataloged in [`LOGS.md`](file:///c:/Users/Teja%20sahith/OneDrive/文件/Desktop/rohit/LOGS.md).

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: `22.x` or higher
- **PostgreSQL**: `16.x` (Local installation or Docker)
- **npm**: `10.x` or higher

### 1. Clone & Install
```bash
git clone https://github.com/rohitsagar9/SunOdoo.git
cd SunOdoo
npm install
```

### 2. Configure Environment Files

**API Environment (`apps/api/.env`):**
```env
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/sunodoopower?schema=public"
JWT_SECRET="sunodoo-super-secret-jwt-key-2026"
PORT=4000
HOST="0.0.0.0"
WEB_ORIGIN="http://localhost:3000"
PUBLIC_API_URL="http://localhost:4000/api"
UPLOAD_DIR="./uploads"
UPI_ID="sunpower@upi"
UPI_NAME="SunOdoo Energy Solutions Pvt. Ltd."
```

**Web Environment (`apps/web/.env.local`):**
```env
NEXT_PUBLIC_API_URL="http://localhost:4000"
NEXT_PUBLIC_UPI_ID="sunpower@upi"
NEXT_PUBLIC_UPI_NAME="SunOdoo Energy Solutions"
```

### 3. Database Migration & Deterministic Seed
Initialize your PostgreSQL database and seed realistic demo customers, quotes, jobs, and serialized units:
```bash
# Push Prisma schema to PostgreSQL
npm run db:push

# Seed complete enterprise demo datasets
npm run db:seed

# Generate SVG Code 128 barcodes for warehouse
npm run assets
```

### 4. Start Development Daemons
```bash
npm run dev
```
- **Web Application:** [http://localhost:3000](http://localhost:3000)
- **API Server:** [http://localhost:4000](http://localhost:4000)
- **API Health Check:** [http://localhost:4000/api/health](http://localhost:4000/api/health)

---

## 🔑 Demo Accounts & Pre-Seeded Scenarios

All pre-seeded demo accounts share the uniform password: **`SunPower@123`**

| Role | Email | Direct Dashboard | Typical Scenario |
| :--- | :--- | :--- | :--- |
| **Director** | `director@sunpower.in` | `/dashboard/director` | Review month-to-date P&L, approve restock orders, track gross margins. |
| **Sales** | `sales@sunpower.in` | `/dashboard/sales` | Create 3kW on-grid quote, verify UPI advance payment proof. |
| **Technician** | `tech@sunpower.in` | `/dashboard/schedule` | Clock in on mobile, capture customer touch sign-off, complete repair bill. |
| **Warehouse** | `warehouse@sunpower.in` | `/dashboard/warehouse` | Scan Code 128 inverter barcodes, verify dispatch readiness checklist. |
| **Support** | `support@sunpower.in` | `/dashboard/support` | Review warranty breakdown ticket, 1-click approve ₹0 replacement. |

### Featured Live Demo Links:
- **Interactive Public Quote:** [`/q/demo-meenakshi`](http://localhost:3000/q/demo-meenakshi) or [`/q/demo-naveen`](http://localhost:3000/q/demo-naveen)
- **Customer Self-Service Portal:** [`/portal`](http://localhost:3000/portal) *(Enter phone: `9876543210` or `9876543218`)*
- **Public SolarCare™ Helpline & Issue Form:** [`/#support`](http://localhost:3000/#support)

---

## 🔌 Complete REST API Reference

Base URL: `http://localhost:4000/api` • All protected endpoints require `Authorization: Bearer <JWT>`

| Domain | Method | Endpoint | Purpose |
| :--- | :--- | :--- | :--- |
| **Authentication** | `POST` | `/auth/login` | Email and password authentication returning JWT. |
| | `GET` | `/auth/me` | Current session user profile and permissions. |
| | `GET` | `/auth/users` | List active enterprise staff by role. |
| **Public Engine** | `POST` | `/public/inquiries` | Ingest landing page customer solar enquiry. |
| | `POST` | `/public/support-ticket` | Submit SolarCare breakdown ticket with auto-warranty check. |
| | `GET` | `/public/quotes/:token` | Retrieve customer quotation by secure public token. |
| | `POST` | `/public/quotes/:token/accept` | Customer digital acceptance of quote. |
| | `POST` | `/public/quotes/:token/payments` | Upload advance UPI payment screenshot. |
| | `GET` | `/public/track/:phone` | Customer portal live order tracking. |
| **Leads & Surveys** | `GET/POST`| `/leads` | Lead pipeline management and Kanban board. |
| | `POST` | `/leads/:id/verify` | Mark customer phone/site as verified. |
| | `POST` | `/leads/:id/survey` | Schedule on-site technician roof measurement. |
| **Quotations** | `GET/POST`| `/quotes` | Dynamic BOM quote generation and pricing recalculation. |
| **Logistics & Orders**| `GET` | `/orders` | Filter orders across delivery and payment states. |
| | `POST` | `/orders/:id/pack-all` | Batch pack kit hardware items. |
| | `POST` | `/orders/:id/scan` | Verify serial number against assigned order. |
| | `POST` | `/orders/:id/dispatch` | Confirm dispatch and trigger warranty start date. |
| **Field Jobs** | `GET` | `/jobs` | Schedule list filtered by date, role, or status. |
| | `POST` | `/jobs/:id/clock-in` | Geotagged clock-in and start work log. |
| | `POST` | `/jobs/:id/photos` | Upload proof photos of installed plant. |
| | `POST` | `/jobs/:id/signature` | Store customer digital touch signature. |
| | `POST` | `/jobs/:id/submit-inspection` | Submit diagnostic report (Option 1 vs 2). |
| | `POST` | `/jobs/:id/complete` | Complete repair/installation & generate tax bill. |
| **Support & Warranty**| `GET/POST`| `/tickets` | SolarCare ticket lifecycle and warranty status. |
| | `POST` | `/tickets/:id/approve-repair` | 1-Click approve ₹0 warranty or billable repair. |
| | `POST` | `/tickets/:id/generate-bill` | Generate official `SP-INV` service tax invoice. |
| | `GET` | `/support/lookup` | Universal lookup by phone, serial, or order. |

---

## 📜 Monorepo Structure

```
SunOdoo/
├── apps/
│   ├── api/                           # Fastify 5 REST API microservice
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # PostgreSQL relational schema
│   │   │   ├── seed.ts                # Deterministic enterprise seed script
│   │   │   └── seed-more-data.ts      # Volume test data generator
│   │   ├── src/
│   │   │   ├── catalog/               # OEM hardware specifications & SKUs
│   │   │   ├── lib/                   # Sequence generator, audit logger, auth
│   │   │   ├── routes/                # Route handlers (jobs, tickets, quotes, etc.)
│   │   │   └── services/              # BOM pricing engine, warranty detector
│   │   └── uploads/                   # Uploaded proofs and signatures
│   └── web/                           # Next.js 16 App Router web & PWA
│       ├── app/                       # App Router routes and dashboards
│       │   ├── dashboard/             # Role-gated enterprise dashboards
│       │   ├── portal/                # Public customer order tracker
│       │   └── q/[token]/             # Public quote acceptance portal
│       ├── components/                # ServiceInvoiceModal, SignaturePad, UI
│       └── public/                    # Code 128 barcode SVGs & UPI assets
├── scripts/
│   ├── generate-assets.mjs            # Code 128 barcode batch generator
│   ├── export_logs.mjs                # System audit trail exporter
│   └── verify_customer_journey.mjs    # End-to-end integration test suite
├── LOGS.md                            # Complete historical platform audit trail
└── package.json                       # Monorepo workspace configuration
```

---

## 🛡️ License & Commercial Rights

Copyright © 2026 SunOdoo Energy Solutions Pvt. Ltd. All rights reserved.  
Confidential and proprietary enterprise software.
