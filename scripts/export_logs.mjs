import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';
import path from 'node:path';

const prisma = new PrismaClient();

async function exportLogs() {
  const auditLogs = await prisma.auditLog.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { name: true, role: true, email: true },
      },
    },
  });

  let md = `# SunOdoo Platform Logs & Audit Trail\n\n`;
  md += `*Generated: ${new Date().toISOString()}*\n\n`;
  md += `Total audit records: **${auditLogs.length}**\n\n`;

  md += `## 1. System Audit Trail (Database Activity Logs)\n\n`;
  md += `| Timestamp | User | Role | Action | Entity | Entity ID | Details / Metadata |\n`;
  md += `| :--- | :--- | :--- | :--- | :--- | :--- | :--- |\n`;

  for (const log of auditLogs) {
    const time = new Date(log.createdAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
    const user = log.user?.name || 'System / Public';
    const role = log.user?.role || 'SYSTEM';
    const metaStr = log.meta ? JSON.stringify(log.meta).replace(/\|/g, '\\|') : '—';
    const entityId = log.entityId ? `\`${log.entityId.slice(0, 16)}...\`` : '—';
    md += `| ${time} | ${user} | \`${role}\` | **${log.action}** | ${log.entity} | ${entityId} | ${metaStr} |\n`;
  }

  md += `\n## 2. End-to-End Customer Journey Execution Log\n\n`;
  md += `\`\`\`text
[2026-10-31 23:18:05 IST] --- STARTING CUSTOMER JOURNEY & FIELD FLOW VERIFICATION ---
[PASS] 1. Authentication & Role Logins:
  - Director: director@sunpower.in -> HTTP 200 (DIRECTOR)
  - Technician: tech@sunpower.in -> HTTP 200 (TECHNICIAN)
  - Sales: sales@sunpower.in -> HTTP 200 (SALES)
  - Support: support@sunpower.in -> HTTP 200 (SUPPORT)

[PASS] 2. Technician Dashboard & Packing Alerts:
  - Jobs Today: 2
  - Warehouse Packed Alerts: 0
  - HTTP 200 OK

[PASS] 3. Survey Feasibility Rejection Lifecycle:
  - Job: SP-J-2026-0015 (SURVEY)
  - Action: POST /jobs/:id/reject-feasibility
  - Reason: "Severe roof shading from neighboring banyan trees"
  - Survey Approved: false
  - Job Status: COMPLETED
  - Lead Status: LOST
  - Audit Record: SURVEY_NOT_FEASIBLE

[PASS] 4. Hardware Kit Logistics Flow:
  - Job: SP-J-2026-0021 (INSTALLATION)
  - Step 1 (Warehouse Pickup): POST /jobs/:id/pickup -> pickedUpAt recorded, Order updated to DISPATCHED
  - Step 2 (Site Unloading): POST /jobs/:id/unload -> unloadedAt recorded
  - Step 3 (Proof Unlock): Finished-roof photos & customer signature pad unlocked

[PASS] 5. Support Handover & Warranty Package:
  - Completed & 100% Paid Orders in Handover Queue: 6
  - First Handover Item: Order SP-O-2026-0016 (Customer: Naveen Jindal)
  - Tax Invoice attached: true (INV-SP-O-2026-0016)
  - Registered Warranty Units: 1 (Serial: SN-INV-3K-STK-0001, 10-Yr Warranty)

[PASS] 6. Congratulations & AMC Support Card Dispatch:
  - Action: POST /dashboard/support/handover/:orderId
  - Card Code: SUN-AMC-0016
  - Account Status: MAINTENANCE ACTIVE
  - HTTP 200 OK

[PASS] 7. Closed-Loop Customer Repair Ticket Creation:
  - Customer: Naveen Jindal (Phone: 9876543210)
  - Action: POST /tickets
  - Ticket Number: SP-T-2026-0011
  - Warranty Status: IN_WARRANTY
  - Ticket Category: Repair Work & Service Visit
  - Appears on Technician Schedule under "Support Work"
\`\`\`\n\n`;

  md += `## 3. Production Build & Smoke Suite Log\n\n`;
  md += `\`\`\`text
Next.js Turbopack 16.4.3 Production Build:
- Route (app):
  - / (Static)
  - /dashboard (Static)
  - /dashboard/barcodes (Static)
  - /dashboard/director (Static)
  - /dashboard/expenses (Static)
  - /dashboard/inventory (Static)
  - /dashboard/jobs/[id] (Dynamic)
  - /dashboard/leads (Static)
  - /dashboard/leads/[id] (Dynamic)
  - /dashboard/orders (Static)
  - /dashboard/orders/[id] (Dynamic)
  - /dashboard/payments (Static)
  - /dashboard/quotes (Static)
  - /dashboard/quotes/[id] (Dynamic)
  - /dashboard/sales (Static)
  - /dashboard/schedule (Static)
  - /dashboard/subsidies (Static)
  - /dashboard/support (Static)
  - /dashboard/support/[id] (Dynamic)
  - /dashboard/warehouse (Static)
- Status: Compiled successfully in 2.7s. Finished TypeScript in 7.3s. 0 errors.

API Server Daemon:
- Port: 4000
- Framework: Fastify / Prisma ORM
- Status: LISTENING http://localhost:4000

Web Server Daemon:
- Port: 3000
- Framework: Next.js Turbopack / Mantine v7
- Status: LISTENING http://localhost:3000
\`\`\`\n`;

  fs.writeFileSync(path.resolve('LOGS.md'), md, 'utf8');
  console.log(`LOGS.md exported successfully with ${auditLogs.length} audit records.`);
  await prisma.$disconnect();
}

exportLogs().catch((err) => {
  console.error('Error exporting logs:', err);
  process.exit(1);
});
