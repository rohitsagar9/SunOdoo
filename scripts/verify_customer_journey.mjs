import assert from 'node:assert';

const API_BASE = 'http://localhost:4000/api';

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`;
  const headers = { ...(options.headers || {}) };
  if (options.body && !headers['Content-Type']) {
    headers['Content-Type'] = 'application/json';
  }
  const res = await fetch(url, {
    ...options,
    headers,
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`[${res.status}] ${path}: ${JSON.stringify(data)}`);
  }
  return data;
}

async function login(email, password = 'SunPower@123') {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return res.token;
}

async function runVerification() {
  console.log('🌟 Starting End-to-End Verification of 5-Phase Customer Journey...\n');

  // Log in actors
  const salesToken = await login('sales@sunpower.in');
  const techToken = await login('tech@sunpower.in');
  const directorToken = await login('director@sunpower.in');
  const supportToken = await login('support@sunpower.in');

  const salesHeaders = { Authorization: `Bearer ${salesToken}` };
  const techHeaders = { Authorization: `Bearer ${techToken}` };
  const directorHeaders = { Authorization: `Bearer ${directorToken}` };
  const supportHeaders = { Authorization: `Bearer ${supportToken}` };

  const uniqueSuffix = Date.now().toString().slice(-6);
  const testPhone = `98765${uniqueSuffix}`;

  // ==========================================
  // PHASE 1: Form Entry & "Search Persons" Priority Queue
  // ==========================================
  console.log('--- Phase 1: Customer Form Entry & Priority Enquiry Queue ---');
  const inquiry = await request('/public/inquiries', {
    method: 'POST',
    body: JSON.stringify({
      name: `Rohit Customer ${uniqueSuffix}`,
      phone: testPhone,
      email: `rohit_${uniqueSuffix}@example.com`,
      address: `Plot ${uniqueSuffix}, Hitec City, Jubilee Hills`,
      city: 'Hyderabad',
      requestedKw: 3,
      systemType: 'ON_GRID',
      monthlyBill: 5500,
      roofAreaSqft: 650,
      notes: 'Customer interested in 3kW residential rooftop system with DISCOM net-meter.',
    }),
  });
  assert(inquiry.leadId, 'Lead ID must be generated');
  console.log(`✅ Lead registered: Reference ${inquiry.reference}, ID: ${inquiry.leadId}`);

  // Fetch leads and check FIFO sorting
  const leads = await request('/leads', { headers: salesHeaders });
  assert(Array.isArray(leads) && leads.length > 0, 'Leads list must be non-empty');
  const ourLead = leads.find((l) => l.id === inquiry.leadId);
  assert(ourLead, 'Submitted lead must be in Search Persons list');
  console.log(`✅ Lead found in queue with status: ${ourLead.status}`);

  // Sales updates submitted form details after calling customer
  const updatedLead = await request(`/leads/${inquiry.leadId}`, {
    method: 'PATCH',
    headers: salesHeaders,
    body: JSON.stringify({
      requestedKw: 3,
      monthlyBill: 6000,
      roofAreaSqft: 700,
      notes: 'Customer confirmed RCC roof slab during phone call. Ready for site survey.',
    }),
  });
  assert.strictEqual(updatedLead.monthlyBill, 6000, 'Monthly bill must be updated');
  assert.strictEqual(updatedLead.roofAreaSqft, 700, 'Roof area must be updated');
  console.log('✅ Sales edited customer details while on call with customer');

  // Book survey with technician
  const techUser = await request('/auth/users?role=TECHNICIAN', { headers: salesHeaders });
  assert(techUser.length > 0, 'Must have at least one technician');
  const technicianId = techUser[0].id;

  const surveyBooking = await request(`/leads/${inquiry.leadId}/survey`, {
    method: 'POST',
    headers: salesHeaders,
    body: JSON.stringify({
      technicianId,
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
      slot: '14:00 - 15:30',
      notes: 'Inspect terrace shading from parapet wall and check 3-phase DB location.',
    }),
  });
  assert(surveyBooking.id, 'Survey ID must be generated');
  console.log(`✅ Survey scheduled for technician: ID ${surveyBooking.id}`);

  // ==========================================
  // PHASE 2: Survey Execution & Sales Feasibility Override
  // ==========================================
  console.log('\n--- Phase 2: Technician Assessment & Sales Feasibility Override ---');
  // Technician visits site and saves measurements first
  const surveyMeasurements = await request(`/surveys/${surveyBooking.id}`, {
    method: 'PATCH',
    headers: techHeaders,
    body: JSON.stringify({
      roofDirection: 'South-South-West',
      tiltDegrees: 15,
      cableDistanceM: 22,
      shadowFreeAreaSqft: 500,
      findings: 'Parapet wall 4ft high creates morning shadow on south-east side.',
    }),
  });
  console.log('✅ Technician saved measurements first');

  // Technician assesses site as NOT_FEASIBLE
  const surveyJob = await request('/jobs', {
    headers: techHeaders,
  });
  const ourSurveyJob = surveyJob.find((j) => j.leadId === inquiry.leadId && j.type === 'SURVEY');
  assert(ourSurveyJob, 'Survey job must exist for technician');

  const techRejection = await request(`/jobs/${ourSurveyJob.id}/reject-feasibility`, {
    method: 'POST',
    headers: techHeaders,
    body: JSON.stringify({
      reason: 'Parapet shadow on east side reduces effective shadow-free area.',
    }),
  });
  console.log('✅ Technician marked Not Feasible. Status pending sales review.');

  // Verify lead is NOT lost yet!
  const leadBeforeOverride = await request(`/leads/${inquiry.leadId}`, { headers: salesHeaders });
  assert.notStrictEqual(leadBeforeOverride.status, 'LOST', 'Lead must not be auto-killed; sales has override rights');

  // Sales reviews and overrides to Feasible with mandatory explanation
  const salesOverride = await request(`/surveys/${surveyBooking.id}/sales-decision`, {
    method: 'POST',
    headers: salesHeaders,
    body: JSON.stringify({
      decision: 'OVERRIDE_TO_FEASIBLE',
      reason: 'Customer approved 3ft raised hot-dip galvanized mounting structure to clear parapet height.',
    }),
  });
  assert(salesOverride.approved, 'Survey must be approved after sales override');
  assert(salesOverride.overrideReason, 'Override reason must be persisted');
  console.log(`✅ Sales verified and Overrode to Feasible: "${salesOverride.overrideReason}"`);

  // ==========================================
  // PHASE 3: Quotation with Percentage-Based Discount
  // ==========================================
  console.log('\n--- Phase 3: Percentage-Based Quotation (URL & PDF) ---');
  const quote = await request('/quotes', {
    method: 'POST',
    headers: salesHeaders,
    body: JSON.stringify({
      leadId: inquiry.leadId,
      capacityKw: 3,
      systemType: 'ON_GRID',
      discountPercent: 2, // 2% customizable discount
      notes: '2% promotional discount applied as discussed on call.',
    }),
  });
  assert(quote.id, 'Quote must be generated');
  assert.strictEqual(quote.discountPercent, 2, 'Discount percentage must be 2%');
  const expectedDiscount = Math.round((quote.subtotal * 2) / 100);
  assert(Math.abs(quote.discount - expectedDiscount) <= 2, 'Discount rupees must match 2% calculation');
  console.log(`✅ Quote created: ${quote.quoteNumber} | Subtotal: ₹${quote.subtotal} | Discount: 2% (₹${quote.discount}) | Total: ₹${quote.total}`);
  console.log(`✅ Public URL generated: /q/${quote.publicToken}`);

  // ==========================================
  // PHASE 4: Split Payments & Technician Offline Cash
  // ==========================================
  console.log('\n--- Phase 4: Split / Multi-Tranche Payments & Technician Offline Cash ---');
  // Customer accepts quote
  const acceptedQuote = await request(`/public/quotes/${quote.publicToken}/accept`, {
    method: 'POST',
  });
  assert(acceptedQuote.order, 'Order must be created on quote acceptance');
  const orderId = acceptedQuote.order.id;
  console.log(`✅ Quote accepted. Order created: ${acceptedQuote.order.orderNumber}`);

  // Technician reports collecting offline cash on site with credibility confirmed
  const offlineCash = await request('/payments/offline-cash', {
    method: 'POST',
    headers: techHeaders,
    body: JSON.stringify({
      orderId,
      amount: quote.advanceAmount,
      credibilityConfirmed: true,
      notes: 'Technician collected physical cash advance from customer Rohit on site.',
    }),
  });
  assert.strictEqual(offlineCash.credibilityConfirmed, true, 'Credibility declaration must be true');
  assert.strictEqual(offlineCash.cashDepositVerified, false, 'Must be unverified until office confirms');
  console.log(`✅ Technician recorded offline cash: ₹${offlineCash.amount} with credibility confirmed`);

  // Technician nudges office to check
  const nudge = await request(`/payments/${offlineCash.id}/nudge-office`, {
    method: 'POST',
    headers: techHeaders,
  });
  assert(nudge.success, 'Nudge office must succeed');
  console.log('✅ Technician sent nudge to office to check physical cash deposit');

  // Office / Sales desk verifies cash deposit and approves
  const verifiedCash = await request(`/payments/${offlineCash.id}/verify-cash`, {
    method: 'POST',
    headers: salesHeaders,
  });
  assert.strictEqual(verifiedCash.status, 'APPROVED', 'Cash payment must be APPROVED');
  assert.strictEqual(verifiedCash.cashDepositVerified, true, 'Cash deposit must be verified');
  console.log('✅ Office desk confirmed physical cash deposit and approved advance');

  // Verify order updated to ADVANCE_PAID
  const updatedOrder = await request(`/orders/${orderId}`, { headers: salesHeaders });
  assert.strictEqual(updatedOrder.status, 'ADVANCE_PAID', 'Order must be ADVANCE_PAID');
  console.log(`✅ Order status updated to: ${updatedOrder.status} | Advance Paid: ₹${updatedOrder.advancePaid}`);

  // ==========================================
  // PHASE 5: Warehouse Dispatch -> Kit Pickup -> Site Installation -> Support Congrats PDF
  // ==========================================
  console.log('\n--- Phase 5: Warehouse Dispatch, Kit Pickup, Site Work & Support Congrats ---');
  // Warehouse dispatches order
  const dispatched = await request(`/orders/${orderId}/dispatch`, {
    method: 'POST',
    headers: directorHeaders,
    body: JSON.stringify({ force: true }),
  });
  console.log('✅ Warehouse packed and dispatched hardware kit');

  // Technician picks up hardware kit from warehouse
  const jobs = await request('/jobs', { headers: techHeaders });
  const installJob = jobs.find((j) => j.orderId === orderId && j.type === 'INSTALLATION');
  assert(installJob, 'Installation job must exist');

  const pickedUpJob = await request(`/jobs/${installJob.id}/pickup`, {
    method: 'POST',
    headers: techHeaders,
  });
  assert(pickedUpJob.pickedUpAt, 'Picked up timestamp must be set');
  console.log('✅ Technician marked kit as PICKED UP / COLLECTED from warehouse');

  // Technician unloads kit at installation site
  const unloadedJob = await request(`/jobs/${installJob.id}/unload`, {
    method: 'POST',
    headers: techHeaders,
  });
  assert(unloadedJob.unloadedAt, 'Unloaded timestamp must be set');
  console.log('✅ Technician unloaded kit at site');

  // Capture customer signature
  const dummySignatureData = 'data:image/png;base64,' + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='.repeat(5);
  await request(`/jobs/${installJob.id}/signature`, {
    method: 'POST',
    headers: techHeaders,
    body: JSON.stringify({
      signerName: 'Rohit Customer',
      dataUrl: dummySignatureData,
    }),
  });
  console.log('✅ Customer site signature captured');

  // Upload finished roof installation photo
  const photoForm = new FormData();
  photoForm.append('caption', 'Finished solar array on raised mounting structure');
  photoForm.append('file', new Blob(['dummy-image-content'], { type: 'image/jpeg' }), 'finished_roof.jpg');
  const photoRes = await fetch(`${API_BASE}/jobs/${installJob.id}/photos`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${techToken}` },
    body: photoForm,
  });
  assert(photoRes.ok, 'Photo upload must succeed');
  console.log('✅ Finished roof installation photo uploaded');

  // Settle remaining balance offline cash so order is fully paid
  const balancePayment = await request('/payments/offline-cash', {
    method: 'POST',
    headers: techHeaders,
    body: JSON.stringify({
      orderId,
      amount: updatedOrder.balanceDue,
      credibilityConfirmed: true,
      notes: 'Final balance collected after commissioning.',
    }),
  });
  await request(`/payments/${balancePayment.id}/verify-cash`, {
    method: 'POST',
    headers: salesHeaders,
  });
  console.log(`✅ Final balance of ₹${updatedOrder.balanceDue} collected and verified by office`);

  // Complete installation job
  const completedJob = await request(`/jobs/${installJob.id}/complete`, {
    method: 'POST',
    headers: techHeaders,
    body: JSON.stringify({
      completionNotes: 'Plant commissioned successfully. Discom bidirectional meter synchronized.',
      systemSizeKw: 3,
      testResult: 'Generation normal, inverter operating at 3.1 kW peak',
    }),
  });
  console.log(`✅ Installation job closed with status: ${completedJob.status}`);

  // Support desk sends congratulations and warranty support certificate
  const congratsDispatch = await request(`/dashboard/support/handover/${orderId}`, {
    method: 'POST',
    headers: supportHeaders,
  });
  assert(congratsDispatch.success, 'Congrats dispatch must succeed');
  console.log(`✅ Support team generated Congrats & Warranty Certificate (Card: ${congratsDispatch.cardCode})`);

  console.log('\n🎉 ALL 5 PHASES OF THE CUSTOMER JOURNEY FULLY VERIFIED AND PASSING! 🎉');
}

runVerification().catch((err) => {
  console.error('\n❌ Verification Failed:', err);
  process.exit(1);
});
