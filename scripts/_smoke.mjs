const BASE = 'http://localhost:4000/api';
const PASSWORD = 'SunPower@123';

const results = [];
function ok(label, detail = '') {
  results.push({ ok: true, label, detail });
  console.log(`PASS  ${label}${detail ? ` — ${detail}` : ''}`);
}
function fail(label, detail) {
  results.push({ ok: false, label, detail });
  console.log(`FAIL  ${label} — ${detail}`);
}

async function call(method, path, { token, body, form, raw } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }
  const response = await fetch(`${BASE}${path}`, { method, headers, body: payload });
  let data = null;
  const text = await response.text();
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: response.status, data };
}

async function expect(label, method, path, options, check) {
  try {
    const result = await call(method, path, options);
    if (result.status < 200 || result.status >= 300) {
      fail(label, `HTTP ${result.status}: ${JSON.stringify(result.data).slice(0, 300)}`);
      return null;
    }
    if (check && !check(result.data)) {
      fail(label, `unexpected payload: ${JSON.stringify(result.data).slice(0, 300)}`);
      return null;
    }
    ok(label, `HTTP ${result.status}`);
    return result.data;
  } catch (error) {
    fail(label, error.message);
    return null;
  }
}

const accounts = {
  director: 'director@sunpower.in',
  sales: 'sales@sunpower.in',
  technician: 'tech@sunpower.in',
  technician2: 'tech2@sunpower.in',
  warehouse: 'warehouse@sunpower.in',
  support: 'support@sunpower.in',
};

const tokens = {};

async function loginAll() {
  for (const [role, email] of Object.entries(accounts)) {
    const data = await expect(`login ${role}`, 'POST', '/auth/login', {
      body: { email, password: PASSWORD },
    }, (payload) => payload?.token && payload?.user?.role);
    if (data) tokens[role] = data.token;
  }
}

async function readEverything() {
  const dashboards = {
    director: '/dashboard/director',
    sales: '/dashboard/sales',
    technician: '/dashboard/technician',
    warehouse: '/dashboard/warehouse',
    support: '/dashboard/support',
  };
  for (const [role, path] of Object.entries(dashboards)) {
    await expect(`${role} dashboard`, 'GET', path, { token: tokens[role] });
  }

  await expect('leads list', 'GET', '/leads', { token: tokens.sales }, (d) => Array.isArray(d) && d.length > 0);
  await expect('quotes list', 'GET', '/quotes', { token: tokens.sales }, (d) => Array.isArray(d) && d.length > 0);
  await expect('payments list', 'GET', '/payments', { token: tokens.sales }, (d) => Array.isArray(d));
  await expect('orders list', 'GET', '/orders', { token: tokens.sales }, (d) => Array.isArray(d) && d.length > 0);
  await expect('jobs list', 'GET', '/jobs', { token: tokens.technician }, (d) => Array.isArray(d));
  await expect('tickets list', 'GET', '/tickets', { token: tokens.support }, (d) => Array.isArray(d));
  await expect('support lookup', 'GET', '/support/lookup?q=9876543218', { token: tokens.support }, (d) => d?.customers?.length > 0);
  await expect('inventory summary', 'GET', '/inventory/summary', { token: tokens.warehouse }, (d) => Array.isArray(d) && d.length > 0);
  await expect('inventory serials', 'GET', '/inventory', { token: tokens.warehouse }, (d) => Array.isArray(d) && d.length > 0);
  await expect('subsidies', 'GET', '/subsidies', { token: tokens.sales }, (d) => Array.isArray(d) && d.length > 0);
  await expect('expenses (sales)', 'GET', '/expenses', { token: tokens.sales }, (d) => Array.isArray(d) && d.length > 0);
  await expect('expenses (director)', 'GET', '/expenses', { token: tokens.director }, (d) => Array.isArray(d) && d.length > 0);
  await expect('catalog', 'GET', '/catalog', { token: tokens.sales }, (d) => d?.products?.length > 0);
  await expect('products', 'GET', '/products', { token: tokens.sales }, (d) => Array.isArray(d) && d.length > 0);

  // Role enforcement checks
  const denied = await call('GET', '/dashboard/director', { token: tokens.sales });
  if (denied.status === 403) ok('RBAC blocks sales from director dashboard');
  else fail('RBAC blocks sales from director dashboard', `HTTP ${denied.status}`);
}

async function publicReads() {
  await expect('public track', 'GET', '/public/track/9876543218', {}, (d) => d?.orders?.length > 0);
  const tokensList = [
    'demo-meenakshi', 'demo-david', 'demo-pooja', 'demo-lakshmi', 'demo-arjun',
    'demo-naveen', 'demo-kavita', 'demo-ramesh', 'demo-rohit',
  ];
  const quotes = [];
  for (const token of tokensList) {
    const quote = await expect(`public quote ${token}`, 'GET', `/public/quotes/${token}`, {});
    if (quote) quotes.push(quote);
  }
  return quotes;
}

function pngBlob() {
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64',
  );
  return new Blob([png], { type: 'image/png' });
}

async function fullFlow(quotes) {
  const candidate =
    quotes.find((quote) => !quote.order && quote.status === 'SENT') ??
    quotes.find((quote) => quote.status === 'SENT') ??
    quotes[0];
  if (!candidate) {
    fail('full flow candidate quote', 'no public quotes returned');
    return;
  }
  ok('full flow quote selected', `${candidate.quoteNumber} (${candidate.publicToken})`);

  const accepted = await expect(
    'accept public quote',
    'POST',
    `/public/quotes/${candidate.publicToken}/accept`,
    {},
    (d) => d?.order?.id,
  );
  if (!accepted) return;
  const orderId = accepted.order.id;
  const orderNumber = accepted.order.orderNumber;
  ok('order created', `${orderNumber} (${orderId})`);

  const balance = accepted.order.total;
  const amount = Math.max(1, Math.min(candidate.advanceAmount || Math.round(balance * 0.4), balance));

  const form = new FormData();
  form.append('amount', String(amount));
  form.append('method', 'UPI');
  form.append('reference', `SMOKE-${Date.now()}`);
  form.append('notes', 'Automated end-to-end verification');
  form.append('payment', pngBlob(), 'payment-proof.png');

  const payment = await expect(
    'upload public payment screenshot',
    'POST',
    `/public/quotes/${candidate.publicToken}/payments`,
    { form },
    (d) => d?.payment?.id && d?.payment?.status === 'PENDING',
  );
  if (!payment) return;

  const pending = await expect(
    'payment appears in office queue',
    'GET',
    '/payments?status=PENDING',
    { token: tokens.sales },
    (d) => Array.isArray(d) && d.some((item) => item.id === payment.payment.id),
  );
  if (!pending) return;

  await expect(
    'office approves payment',
    'POST',
    `/payments/${payment.payment.id}/approve`,
    { token: tokens.sales },
    (d) => d?.status === 'APPROVED',
  );

  const order = await expect(
    'order moves to advance paid with installation job',
    'GET',
    `/orders/${orderId}`,
    { token: tokens.sales },
    (d) => d?.status === 'ADVANCE_PAID' && d?.job?.id,
  );
  if (!order) return;

  // Ensure enough serialised stock for every mandatory-scan kit item.
  const kit = order.kitItems ?? [];
  const mandatory = kit.filter((item) => ['INVERTER', 'BATTERY', 'CHARGE_CONTROLLER'].includes(item.product.category));
  const stock = await expect('warehouse stock read', 'GET', '/inventory?status=IN_STOCK', {
    token: tokens.warehouse,
  }, (d) => Array.isArray(d));
  if (!stock) return;

  for (const item of mandatory) {
    const available = stock.filter((unit) => unit.productId === item.productId).length;
    if (available < item.quantity) {
      const receiveForm = new FormData();
      receiveForm.append('productId', item.productId);
      receiveForm.append('quantity', String(item.quantity - available + 1));
      receiveForm.append('warehouseLocation', 'Smoke test bay');
      await expect(
        `receive stock for ${item.product.sku}`,
        'POST',
        '/inventory',
        { token: tokens.warehouse, form: receiveForm },
        (d) => d?.created > 0,
      );
    }
  }

  await expect('pack all kit items', 'POST', `/orders/${orderId}/pack-all`, {
    token: tokens.warehouse,
  }, (d) => d?.id === orderId);

  const freshStock = await expect('re-read stock for scanning', 'GET', '/inventory?status=IN_STOCK', {
    token: tokens.warehouse,
  }, (d) => Array.isArray(d));
  if (!freshStock) return;

  for (const item of mandatory) {
    const serials = freshStock
      .filter((unit) => unit.productId === item.productId)
      .slice(0, item.quantity);
    for (const unit of serials) {
      await expect(
        `scan ${unit.serialNumber}`,
        'POST',
        `/orders/${orderId}/scan`,
        { token: tokens.warehouse, body: { serialNumber: unit.serialNumber } },
        (d) => d?.unit?.serialNumber === unit.serialNumber,
      );
    }
  }

  const dispatched = await expect('dispatch order', 'POST', `/orders/${orderId}/dispatch`, {
    token: tokens.warehouse,
  }, (d) => d?.status === 'DISPATCHED');
  if (!dispatched) return;

  const jobs = await expect('technician job list', 'GET', '/jobs', {
    token: tokens.technician,
  }, (d) => Array.isArray(d));
  if (!jobs) return;
  const job = jobs.find((item) => item.order?.id === orderId);
  if (!job) {
    fail('installation job found for technician', `no job for order ${orderNumber}`);
    return;
  }
  ok('installation job found', `${job.jobNumber}`);

  await expect('clock in', 'POST', `/jobs/${job.id}/clock-in`, { token: tokens.technician }, (d) => d?.timeLog?.id);
  await expect('clock out', 'POST', `/jobs/${job.id}/clock-out`, { token: tokens.technician }, (d) => d?.minutes >= 1);

  const photoForm = new FormData();
  photoForm.append('caption', 'Finished roof — smoke verification');
  photoForm.append('photo', pngBlob(), 'roof.png');
  await expect('upload roof photo', 'POST', `/jobs/${job.id}/photos`, {
    token: tokens.technician,
    form: photoForm,
  }, (d) => d?.id);

  const signature =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  await expect('capture signature', 'POST', `/jobs/${job.id}/signature`, {
    token: tokens.technician,
    body: { signerName: 'Smoke Customer', dataUrl: signature },
  }, (d) => d?.id);

  const completed = await expect('complete installation', 'POST', `/jobs/${job.id}/complete`, {
    token: tokens.technician,
    body: { completionNotes: 'Smoke test completion', testResult: 'Voltage and earthing OK' },
  }, (d) => d?.status === 'COMPLETED');
  if (!completed) return;

  const installedOrder = await expect('order installed + warranty started', 'GET', `/orders/${orderId}`, {
    token: tokens.sales,
  }, (d) => d?.status === 'INSTALLED' && d?.inventoryUnits?.every((unit) => unit.status === 'INSTALLED' && unit.warrantyEnd));
  if (!installedOrder) return;

  const serial = installedOrder.inventoryUnits?.[0]?.serialNumber;

  const publicTicket = await expect('public ticket raised', 'POST', '/public/tickets', {
    body: {
      phone: installedOrder.customer.phone,
      serialNumber: serial,
      issue: 'Smoke test: inverter display flickers after installation.',
      faultCode: 'E-03',
    },
  }, (d) => d?.ticketNumber);
  if (!publicTicket) return;

  const ticketList = await expect('ticket visible to support', 'GET', '/tickets?search=' + publicTicket.ticketNumber, {
    token: tokens.support,
  }, (d) => Array.isArray(d) && d.some((ticket) => ticket.ticketNumber === publicTicket.ticketNumber));
  if (!ticketList) return;
  const ticket = ticketList.find((item) => item.ticketNumber === publicTicket.ticketNumber);

  await expect('support resolves ticket', 'PATCH', `/tickets/${ticket.id}`, {
    token: tokens.support,
    body: { status: 'RESOLVED', resolution: 'Reseated display ribbon; tested OK.' },
  }, (d) => d?.status === 'RESOLVED');

  await expect('customer confirms repair', 'POST', `/public/tickets/${publicTicket.ticketNumber}/confirm`, {
    body: { phone: installedOrder.customer.phone },
  }, (d) => d?.status === 'CLOSED');

  await expect('public portal reflects order', 'GET', `/public/track/${installedOrder.customer.phone}`, {}, (d) =>
    d?.orders?.some((item) => item.orderNumber === orderNumber),
  );
}

async function publicInquiry() {
  const phone = `9${Date.now().toString().slice(-9)}`;
  await expect('public inquiry creates lead', 'POST', '/public/inquiries', {
    body: {
      name: 'Smoke Test Prospect',
      phone,
      address: '12 Test Layout, Bengaluru',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560001',
      requestedKw: 3,
      systemType: 'ON_GRID',
      monthlyBill: 4200,
      roofAreaSqft: 620,
      notes: 'Automated verification lead',
    },
  }, (d) => d?.reference);
  await expect('new lead appears in sales pipeline', 'GET', '/leads', {
    token: tokens.sales,
  }, (d) => Array.isArray(d) && d.some((lead) => lead.customer.phone === phone));
}

(async () => {
  await loginAll();
  if (Object.keys(tokens).length < 6) {
    console.error('Not all logins succeeded; aborting.');
    process.exitCode = 1;
    return;
  }
  await readEverything();
  const quotes = await publicReads();
  await publicInquiry();
  await fullFlow(quotes);

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
  if (failed.length) {
    console.log('Failures:');
    for (const item of failed) console.log(` - ${item.label}: ${item.detail}`);
    process.exitCode = 1;
  }
})().catch((error) => {
  console.error('Smoke test crashed:', error);
  process.exitCode = 1;
});
