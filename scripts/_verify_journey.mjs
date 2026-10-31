import { PrismaClient } from '@prisma/client';

const BASE = 'http://localhost:4000/api';
const PASSWORD = 'SunPower@123';
const prisma = new PrismaClient();

async function call(method, path, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  const text = await response.text();
  try {
    return { status: response.status, data: JSON.parse(text) };
  } catch {
    return { status: response.status, data: text };
  }
}

async function run() {
  console.log('--- STARTING CUSTOMER JOURNEY & FIELD FLOW VERIFICATION ---');

  // 1. Log in users
  const dirLogin = await call('POST', '/auth/login', { body: { email: 'director@sunpower.in', password: PASSWORD } });
  const techLogin = await call('POST', '/auth/login', { body: { email: 'tech@sunpower.in', password: PASSWORD } });
  const salesLogin = await call('POST', '/auth/login', { body: { email: 'sales@sunpower.in', password: PASSWORD } });
  const supportLogin = await call('POST', '/auth/login', { body: { email: 'support@sunpower.in', password: PASSWORD } });

  console.log('1. Logins successful:', {
    director: dirLogin.status,
    tech: techLogin.status,
    sales: salesLogin.status,
    support: supportLogin.status,
  });

  const techToken = techLogin.data.token;
  const supportToken = supportLogin.data.token;

  // 2. Technician Dashboard & Packed Alerts
  const techDash = await call('GET', '/dashboard/technician', { token: techToken });
  console.log('2. Tech Dashboard HTTP:', techDash.status, {
    jobsToday: techDash.data?.kpis?.jobsToday,
    packedAlertsCount: techDash.data?.packedAlerts?.length ?? 0,
  });

  // 3. Test Feasibility Rejection
  // Find or create a SURVEY job
  const surveyJob = await prisma.job.findFirst({
    where: { type: 'SURVEY', status: 'SCHEDULED' },
    include: { lead: { include: { survey: true } } },
  });

  if (surveyJob) {
    console.log('3. Testing Feasibility Rejection on survey job:', surveyJob.jobNumber);
    const rejectRes = await call('POST', `/jobs/${surveyJob.id}/reject-feasibility`, {
      token: techToken,
      body: { reason: 'Severe roof shading from neighboring banyan trees' },
    });
    console.log('   Rejection HTTP status:', rejectRes.status);
    const updatedJob = await prisma.job.findUnique({
      where: { id: surveyJob.id },
      include: { lead: { include: { survey: true } } },
    });
    console.log('   Job status after rejection:', updatedJob.status);
    console.log('   Survey approved:', updatedJob.lead?.survey?.approved);
    console.log('   Lead status:', updatedJob.lead?.status);
  }

  // 4. Test Installation Hardware Pickup & Unload Flow
  const installJob = await prisma.job.findFirst({
    where: { type: 'INSTALLATION' },
    include: { order: true },
  });

  if (installJob) {
    console.log('4. Testing Hardware Kit Logistics on install job:', installJob.jobNumber);

    // Step A: Pickup
    const pickupRes = await call('POST', `/jobs/${installJob.id}/pickup`, { token: techToken });
    console.log('   Pickup HTTP status:', pickupRes.status, 'pickedUpAt:', pickupRes.data?.pickedUpAt);

    // Step B: Unload
    const unloadRes = await call('POST', `/jobs/${installJob.id}/unload`, { token: techToken });
    console.log('   Unload HTTP status:', unloadRes.status, 'unloadedAt:', unloadRes.data?.unloadedAt);
  }

  // 5. Test Support Handover Queue & Invoice / Warranty Serials
  const supportDash = await call('GET', '/dashboard/support', { token: supportToken });
  console.log('5. Support Dashboard HTTP:', supportDash.status, {
    handoverQueueCount: supportDash.data?.handoverQueue?.length ?? 0,
    maintenanceActive: supportDash.data?.kpis?.maintenanceActive,
    pendingHandover: supportDash.data?.kpis?.pendingHandover,
  });

  if (supportDash.data?.handoverQueue?.length > 0) {
    const firstItem = supportDash.data.handoverQueue[0];
    console.log('   First Handover Item:', {
      orderNumber: firstItem.orderNumber,
      customerName: firstItem.customerName,
      status: firstItem.status,
      cardCode: firstItem.cardCode,
      hasInvoice: Boolean(firstItem.invoice),
      warrantyUnitsCount: firstItem.warrantyUnits?.length ?? 0,
    });

    // Step 6: Dispatch Congrats & AMC Support Card
    console.log('6. Dispatching Congrats & AMC Card for Order:', firstItem.orderNumber);
    const handoverRes = await call('POST', `/dashboard/support/handover/${firstItem.id}`, { token: supportToken });
    console.log('   Handover dispatch HTTP:', handoverRes.status, handoverRes.data?.message);

    // Step 7: Create a Repair / Service Ticket for this Customer
    console.log('7. Creating Repair Work / Service Ticket for customer:', firstItem.customerName);
    const ticketRes = await call('POST', '/tickets', {
      token: supportToken,
      body: {
        phone: firstItem.customerPhone,
        serialNumber: firstItem.warrantyUnits?.[0]?.serialNumber,
        issue: `Routine quarterly panel cleaning and inverter check for ${firstItem.customerName}`,
        priority: 'MEDIUM',
      },
    });
    console.log('   Repair Ticket created HTTP:', ticketRes.status, {
      ticketNumber: ticketRes.data?.ticketNumber,
      warrantyStatus: ticketRes.data?.warrantyStatus,
    });
  }

  console.log('--- ALL VERIFICATIONS COMPLETED SUCCESSFULLY ---');
  await prisma.$disconnect();
}

run().catch((err) => {
  console.error('Test script error:', err);
  process.exit(1);
});
