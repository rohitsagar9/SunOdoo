import { PrismaClient } from '@prisma/client';
import type {
  JobStatus,
  LeadStatus,
  OrderStatus,
  QuoteStatus,
  SubsidyStatus,
  SystemType,
  TicketPriority,
  TicketStatus,
} from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();
const now = new Date();
const year = now.getFullYear();
const pad = (n: number, size = 4) => String(n).padStart(size, '0');
const daysAgo = (d: number) => new Date(now.getTime() - d * 24 * 60 * 60 * 1000);
const daysFromNow = (d: number) => new Date(now.getTime() + d * 24 * 60 * 60 * 1000);

async function run() {
  console.log('🚀 Seeding comprehensive business data into SunOdoo PostgreSQL...');

  const sales = await prisma.user.findFirst({ where: { role: 'SALES' } });
  const director = await prisma.user.findFirst({ where: { role: 'DIRECTOR' } });
  const tech1 = await prisma.user.findFirst({ where: { role: 'TECHNICIAN' } });
  const tech2 = await prisma.user.findFirst({ where: { role: 'TECHNICIAN', email: { contains: 'tech2' } } }) ?? tech1;
  const warehouse = await prisma.user.findFirst({ where: { role: 'WAREHOUSE' } });
  const support = await prisma.user.findFirst({ where: { role: 'SUPPORT' } });

  if (!sales || !director || !tech1 || !tech2 || !support) {
    throw new Error('Baseline users missing. Run primary db:seed first.');
  }

  // Sequences
  let leadSeq = (await prisma.lead.count()) + 1;
  let quoteSeq = (await prisma.quote.count()) + 1;
  let orderSeq = (await prisma.order.count()) + 1;
  let jobSeq = (await prisma.job.count()) + 1;
  let ticketSeq = (await prisma.ticket.count()) + 1;
  let invoiceSeq = (await prisma.invoice.count()) + 1;

  // Catalog items
  const products = await prisma.product.findMany();
  const prodMap = new Map(products.map((p) => [p.sku, p]));

  // 1. ADD BULK INVENTORY UNITS (Stock & Serials)
  console.log('📦 Generating warehouse inventory stock...');
  const newStockSkus = [
    { sku: 'INV-2K', count: 12, loc: 'Bay A-1 · Inverters' },
    { sku: 'INV-3K', count: 15, loc: 'Bay A-2 · Inverters' },
    { sku: 'INV-4K', count: 10, loc: 'Bay A-3 · Inverters' },
    { sku: 'INV-5K', count: 14, loc: 'Bay A-4 · Inverters' },
    { sku: 'BAT-2.4K', count: 8, loc: 'Bay B-1 · Storage' },
    { sku: 'BAT-5K', count: 12, loc: 'Bay B-2 · Storage' },
    { sku: 'CC-60A', count: 10, loc: 'Bay C-1 · Charge Controllers' },
    { sku: 'PANEL-540W', count: 40, loc: 'Stack P-1 · Tier 1 Mono' },
  ];

  let addedUnits = 0;
  for (const item of newStockSkus) {
    const prod = prodMap.get(item.sku);
    if (!prod) continue;
    const existingCount = await prisma.inventoryUnit.count({ where: { productId: prod.id } });
    const unitsData = Array.from({ length: item.count }, (_, i) => ({
      productId: prod.id,
      serialNumber: `SN-${item.sku}-STK-${pad(existingCount + i + 10)}`,
      status: 'IN_STOCK' as const,
      warehouseLocation: item.loc,
    }));
    await prisma.inventoryUnit.createMany({ data: unitsData, skipDuplicates: true });
    addedUnits += item.count;
  }
  console.log(`   ✓ Added/Ensured new in-stock serialized inventory units.`);

  // 2. BULK CUSTOMERS AND LEADS ACROSS ALL STAGES
  console.log('👥 Generating leads across sales pipeline...');
  const customerLeadsData = [
    // NEW
    {
      name: 'Ananya Singhania',
      phone: '9810144552',
      email: 'ananya.singhania@gmail.com',
      address: 'B-42, Greater Kailash 1',
      city: 'New Delhi',
      state: 'Delhi',
      pincode: '110048',
      monthlyBill: 9500,
      roofAreaSqft: 1200,
      kw: 5,
      type: 'ON_GRID' as SystemType,
      status: 'NEW' as LeadStatus,
      source: 'WEB_FORM' as const,
      notes: 'South Delhi bungalow. Interested in 5kW DCR solar system for maximum net metering subsidy.',
    },
    {
      name: 'Rohan Mehra',
      phone: '9820011223',
      email: 'rohan.mehra@rediffmail.com',
      address: '14, Bandra Kurla Link Road',
      city: 'Mumbai',
      state: 'Maharashtra',
      pincode: '400050',
      monthlyBill: 6800,
      roofAreaSqft: 800,
      kw: 3,
      type: 'ON_GRID' as SystemType,
      status: 'NEW' as LeadStatus,
      source: 'WHATSAPP' as const,
      notes: 'Terrace flat. Looking for rooftop solar installation with zero shading.',
    },
    {
      name: 'Suresh Namboodiri',
      phone: '9847055441',
      email: 'suresh.namboodiri@gmail.com',
      address: 'Hill View Villa, Kakkanad',
      city: 'Kochi',
      state: 'Kerala',
      pincode: '682030',
      monthlyBill: 5400,
      roofAreaSqft: 950,
      kw: 3,
      type: 'OFF_GRID' as SystemType,
      status: 'NEW' as LeadStatus,
      source: 'PHONE' as const,
      notes: 'Needs hybrid system with battery backup during heavy monsoon grid trips.',
    },

    // VERIFIED
    {
      name: 'Pradeep Chordia',
      phone: '9414012987',
      email: 'pradeep.chordia@chordia-group.in',
      address: 'Plot 88, C-Scheme',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302001',
      monthlyBill: 14500,
      roofAreaSqft: 2200,
      kw: 5,
      type: 'ON_GRID' as SystemType,
      status: 'VERIFIED' as LeadStatus,
      source: 'WALK_IN' as const,
      notes: 'Spoke on call. Shared solar ROI estimation and PM Surya Ghar scheme details.',
    },
    {
      name: 'Devika Swaminathan',
      phone: '9444098123',
      email: 'devika.swami@gmail.com',
      address: '42 Gandhi Nagar 2nd Main',
      city: 'Bengaluru',
      state: 'Karnataka',
      pincode: '560009',
      monthlyBill: 7200,
      roofAreaSqft: 1000,
      kw: 4,
      type: 'ON_GRID' as SystemType,
      status: 'VERIFIED' as LeadStatus,
      source: 'WEB_FORM' as const,
      notes: 'Requested quotation with high-efficiency mono PERC panels.',
    },

    // SURVEY_SCHEDULED
    {
      name: 'Maheshwari Goud',
      phone: '9849033221',
      email: 'maheshwari.g@gmail.com',
      address: 'Road No. 12, Banjara Hills',
      city: 'Hyderabad',
      state: 'Telangana',
      pincode: '500034',
      monthlyBill: 8800,
      roofAreaSqft: 1300,
      kw: 5,
      type: 'ON_GRID' as SystemType,
      status: 'SURVEY_SCHEDULED' as LeadStatus,
      source: 'WEB_FORM' as const,
      notes: 'Technician Arun scheduled for roof structural assessment and cable routing survey.',
      survey: { techId: tech1.id, scheduledInDays: 1, slot: '10:00 - 11:30' },
    },
    {
      name: 'Bhaskar Sengupta',
      phone: '9831099887',
      email: 'bhaskar.sengupta@tcs.com',
      address: 'Flat 4B, South City Residency, Prince Anwar Shah Road',
      city: 'Kolkata',
      state: 'West Bengal',
      pincode: '700068',
      monthlyBill: 4600,
      roofAreaSqft: 700,
      kw: 3,
      type: 'ON_GRID' as SystemType,
      status: 'SURVEY_SCHEDULED' as LeadStatus,
      source: 'PHONE' as const,
      notes: 'Technician Vikram scheduled for RCC terrace inspection and parapet height check.',
      survey: { techId: tech2.id, scheduledInDays: 2, slot: '14:00 - 15:30' },
    },

    // SURVEY_COMPLETED
    {
      name: 'Sanjay Toshniwal',
      phone: '9829055443',
      email: 'sanjay.tosh@gmail.com',
      address: '215 Shobhagpura Circle',
      city: 'Udaipur',
      state: 'Rajasthan',
      pincode: '313001',
      monthlyBill: 7900,
      roofAreaSqft: 1100,
      kw: 4,
      type: 'ON_GRID' as SystemType,
      status: 'SURVEY_COMPLETED' as LeadStatus,
      source: 'WEB_FORM' as const,
      notes: 'Survey passed. Excellent south orientation, 18 deg pitch, RCC slab supports elevated structure.',
      completedSurvey: {
        techId: tech1.id,
        roofDirection: 'South',
        tiltDegrees: 18,
        cableDistanceM: 20,
        shadowFreeAreaSqft: 950,
        findings: 'Clean unshaded rooftop. Ideal for 4kW grid-tied system with DISCOM net-meter.',
      },
    },
    {
      name: 'Radhika Kulkarni',
      phone: '9823077665',
      email: 'radhika.kulkarni@yahoo.com',
      address: 'Lane 5, Koregaon Park',
      city: 'Pune',
      state: 'Maharashtra',
      pincode: '411001',
      monthlyBill: 6200,
      roofAreaSqft: 850,
      kw: 3,
      type: 'ON_GRID' as SystemType,
      status: 'SURVEY_COMPLETED' as LeadStatus,
      source: 'WEB_FORM' as const,
      notes: 'Feasibility approved. Minimal morning shadow from parapet.',
      completedSurvey: {
        techId: tech2.id,
        roofDirection: 'South-West',
        tiltDegrees: 15,
        cableDistanceM: 18,
        shadowFreeAreaSqft: 750,
        findings: 'Structural integrity solid. Recommended elevated mounting structure.',
      },
    },

    // QUOTED
    {
      name: 'Ashok Varma',
      phone: '9885066778',
      email: 'ashok.varma@varma-constructions.com',
      address: 'MVP Colony Sector 3',
      city: 'Visakhapatnam',
      state: 'Andhra Pradesh',
      pincode: '530017',
      monthlyBill: 9100,
      roofAreaSqft: 1400,
      kw: 5,
      type: 'ON_GRID' as SystemType,
      status: 'QUOTED' as LeadStatus,
      source: 'PHONE' as const,
      notes: 'Quote sent with 5kW mono PERC BOM. Customer reviewing ROI breakdown.',
      quoteToken: 'demo-ashok-vizag',
      discount: 5000,
    },
    {
      name: 'Nirmala Devi',
      phone: '9437011998',
      email: 'nirmala.devi@gmail.com',
      address: 'Plot 104, Saheed Nagar',
      city: 'Bhubaneswar',
      state: 'Odisha',
      pincode: '751007',
      monthlyBill: 5800,
      roofAreaSqft: 900,
      kw: 3,
      type: 'ON_GRID' as SystemType,
      status: 'QUOTED' as LeadStatus,
      source: 'WEB_FORM' as const,
      notes: 'Formal proposal shared online. Explained PM Surya Ghar subsidy payout flow.',
      quoteToken: 'demo-nirmala-bhubaneswar',
      discount: 0,
    },

    // NEGOTIATION
    {
      name: 'Deepak Jha',
      phone: '9861022334',
      email: 'deepak.jha@gmail.com',
      address: 'Sector 62',
      city: 'Noida',
      state: 'Uttar Pradesh',
      pincode: '201301',
      monthlyBill: 8400,
      roofAreaSqft: 1250,
      kw: 4,
      type: 'ON_GRID' as SystemType,
      status: 'NEGOTIATION' as LeadStatus,
      source: 'WEB_FORM' as const,
      notes: 'Customer asked for 3% additional festive discount and extended structure warranty.',
      quoteToken: 'demo-deepak-noida',
      discount: 8000,
    },

    // LOST
    {
      name: 'Tarun Mathur',
      phone: '9828033112',
      email: 'tarun.m@mathurassociates.in',
      address: 'Vaishali Nagar',
      city: 'Jaipur',
      state: 'Rajasthan',
      pincode: '302021',
      monthlyBill: 7500,
      roofAreaSqft: 600,
      kw: 3,
      type: 'ON_GRID' as SystemType,
      status: 'LOST' as LeadStatus,
      source: 'WEB_FORM' as const,
      notes: 'Opted for local unbranded vendor offering non-DCR panels.',
      lostReason: 'Price sensitive — chose low-grade uncertified panels from unorganized vendor.',
    },
    {
      name: 'Kavitha Ramachandran',
      phone: '9447088990',
      email: 'kavitha.r@gmail.com',
      address: 'Pattom Palace Road',
      city: 'Thiruvananthapuram',
      state: 'Kerala',
      pincode: '695004',
      monthlyBill: 6200,
      roofAreaSqft: 500,
      kw: 2,
      type: 'ON_GRID' as SystemType,
      status: 'LOST' as LeadStatus,
      source: 'WALK_IN' as const,
      notes: 'Rooftop tree shading from neighbor property cannot be cleared.',
      lostReason: 'Severe permanent shadow from adjacent building/trees.',
    },
  ];

  for (const item of customerLeadsData) {
    const cust = await prisma.customer.upsert({
      where: { phone: item.phone },
      update: {},
      create: {
        name: item.name,
        phone: item.phone,
        email: item.email,
        address: item.address,
        city: item.city,
        state: item.state,
        pincode: item.pincode,
        monthlyBill: item.monthlyBill,
        roofAreaSqft: item.roofAreaSqft,
      },
    });

    const existingLead = await prisma.lead.findFirst({ where: { customerId: cust.id } });
    if (existingLead) {
      console.log(`   ↷ Lead already exists for ${cust.name}`);
      continue;
    }

    leadSeq += 1;
    const lead = await prisma.lead.create({
      data: {
        reference: `SP-L-${year}-${pad(leadSeq)}`,
        customerId: cust.id,
        requestedKw: item.kw,
        systemType: item.type,
        status: item.status,
        source: item.source,
        assignedToId: sales.id,
        monthlyBill: item.monthlyBill,
        roofAreaSqft: item.roofAreaSqft,
        notes: item.notes,
        lostReason: (item as any).lostReason,
        createdAt: daysAgo(Math.floor(Math.random() * 20) + 2),
      },
    });

    // If survey scheduled
    if ((item as any).survey) {
      const s = (item as any).survey;
      await prisma.survey.create({
        data: {
          leadId: lead.id,
          technicianId: s.techId,
          scheduledAt: daysFromNow(s.scheduledInDays),
          findings: 'Site inspection scheduled.',
        },
      });
      jobSeq += 1;
      await prisma.job.create({
        data: {
          jobNumber: `SP-J-${year}-${pad(jobSeq)}`,
          leadId: lead.id,
          customerId: cust.id,
          type: 'SURVEY',
          status: 'SCHEDULED',
          technicianId: s.techId,
          scheduledDate: daysFromNow(s.scheduledInDays),
          scheduledSlot: s.slot,
          notes: `Roof survey for ${cust.name}.`,
        },
      });
    }

    // If survey completed
    if ((item as any).completedSurvey) {
      const cs = (item as any).completedSurvey;
      await prisma.survey.create({
        data: {
          leadId: lead.id,
          technicianId: cs.techId,
          scheduledAt: daysAgo(3),
          completedAt: daysAgo(1),
          approved: true,
          roofDirection: cs.roofDirection,
          tiltDegrees: cs.tiltDegrees,
          cableDistanceM: cs.cableDistanceM,
          shadowFreeAreaSqft: cs.shadowFreeAreaSqft,
          findings: cs.findings,
        },
      });
      jobSeq += 1;
      await prisma.job.create({
        data: {
          jobNumber: `SP-J-${year}-${pad(jobSeq)}`,
          leadId: lead.id,
          customerId: cust.id,
          type: 'SURVEY',
          status: 'COMPLETED',
          technicianId: cs.techId,
          scheduledDate: daysAgo(3),
          clockInAt: daysAgo(3),
          clockOutAt: daysAgo(3),
          hoursWorked: 1.5,
          completedAt: daysAgo(1),
          notes: cs.findings,
        },
      });
    }

    // If quoted
    if ((item as any).quoteToken) {
      quoteSeq += 1;
      const kw = item.kw;
      const subtotal = kw * 55000;
      const discount = (item as any).discount ?? 0;
      const taxable = subtotal - discount;
      const taxAmount = Math.round(taxable * 0.138);
      const total = taxable + taxAmount;
      const advanceAmount = Math.round(total * 0.3);

      await prisma.quote.create({
        data: {
          quoteNumber: `SP-Q-${year}-${pad(quoteSeq)}`,
          leadId: lead.id,
          customerId: cust.id,
          systemType: item.type,
          capacityKw: kw,
          subtotal,
          discount,
          taxRate: 13.8,
          taxAmount,
          total,
          advanceAmount,
          status: 'SENT',
          validUntil: daysFromNow(14),
          publicToken: (item as any).quoteToken,
          createdById: sales.id,
          createdAt: daysAgo(2),
          items: {
            create: [
              { description: `${kw}kW Tier-1 Monocrystalline Solar PV Modules (DCR)`, category: 'PANEL', quantity: Math.ceil((kw * 1000) / 540), unit: 'nos', unitPrice: 12500, total: Math.ceil((kw * 1000) / 540) * 12500, sortOrder: 0 },
              { description: `${kw}kW On-Grid String Solar Inverter with Dual MPPT`, category: 'INVERTER', quantity: 1, unit: 'unit', unitPrice: kw * 12000, total: kw * 12000, sortOrder: 1 },
              { description: 'Anodized Aluminum Elevated Mounting Structure (Wind speed 150 km/h)', category: 'STRUCTURE', quantity: 1, unit: 'set', unitPrice: kw * 4500, total: kw * 4500, sortOrder: 2 },
              { description: 'Solar Grade XLPO DC & AC Armored Cables (4 sq mm)', category: 'CABLE', quantity: 40, unit: 'm', unitPrice: 110, total: 4400, sortOrder: 3 },
              { description: 'ACDB & DCDB with Type-II SPD and MCBs', category: 'BOS', quantity: 1, unit: 'set', unitPrice: 5800, total: 5800, sortOrder: 4 },
              { description: 'Chemical Earthing Kit with 3 Dedicated Electrodes & LA', category: 'BOS', quantity: 1, unit: 'set', unitPrice: 7200, total: 7200, sortOrder: 5 },
              { description: 'Site Installation, Civil Foundation & Testing', category: 'SERVICE', quantity: kw, unit: 'kW', unitPrice: 3500, total: kw * 3500, sortOrder: 6 },
              { description: 'DISCOM Net-Meter Liaison & PM Surya Ghar Portal Commissioning', category: 'SERVICE', quantity: 1, unit: 'lot', unitPrice: 4500, total: 4500, sortOrder: 7 },
            ],
          },
        },
      });
    }

    console.log(`   ✓ Lead created: ${lead.reference} (${item.status}) for ${cust.name}`);
  }

  // 3. COMPLETE REAL-WORLD ORDERS IN ALL PHASES
  console.log('📑 Generating live orders across order lifecycle...');
  const ordersSetup = [
    // Order 1: PENDING_PAYMENT with customer screenshot waiting in Office Payment Queue
    {
      customerName: 'Gaurav Aggarwal',
      phone: '9811088776',
      city: 'Gurugram',
      state: 'Haryana',
      address: 'Villa 12, Nirvana Country, Sector 50',
      pincode: '122018',
      kw: 5,
      type: 'ON_GRID' as SystemType,
      orderStatus: 'PENDING_PAYMENT' as OrderStatus,
      total: 310000,
      paid: 0,
      hasPendingPayment: true,
      paymentAmount: 93000, // 30% advance
      paymentRef: 'UPI-HDFC-9938210928',
    },
    // Order 2: ADVANCE_PAID in warehouse queue waiting for packing & serial scan
    {
      customerName: 'Siddharth Varma',
      phone: '9845122334',
      city: 'Bengaluru',
      state: 'Karnataka',
      address: '77 Defence Colony, Indiranagar',
      pincode: '560038',
      kw: 3,
      type: 'ON_GRID' as SystemType,
      orderStatus: 'ADVANCE_PAID' as OrderStatus,
      total: 195000,
      paid: 60000,
      paymentMethod: 'BANK_TRANSFER' as const,
      paymentRef: 'NEFT-AXIS-88291039',
      packProgress: 0,
    },
    // Order 3: ADVANCE_PAID with partial packing done
    {
      customerName: 'Manish Chawla',
      phone: '9820499887',
      city: 'Thane',
      state: 'Maharashtra',
      address: 'Highland Park, Kolshet Road',
      pincode: '400607',
      kw: 4,
      type: 'ON_GRID' as SystemType,
      orderStatus: 'ADVANCE_PAID' as OrderStatus,
      total: 255000,
      paid: 80000,
      paymentMethod: 'UPI' as const,
      paymentRef: 'UPI-ICICI-88392100',
      packProgress: 50,
    },
    // Order 4: DISPATCHED with warranty clock started and installation job scheduled
    {
      customerName: 'Dr. Ramesh Chandra',
      phone: '9412033445',
      city: 'Agra',
      state: 'Uttar Pradesh',
      address: '18 Sanjay Place, Civil Lines',
      pincode: '282002',
      kw: 5,
      type: 'ON_GRID' as SystemType,
      orderStatus: 'DISPATCHED' as OrderStatus,
      total: 315000,
      paid: 150000,
      paymentMethod: 'CHEQUE' as const,
      paymentRef: 'CHQ-SBI-402910',
      dispatchedDaysAgo: 1,
      techId: tech1.id,
    },
    // Order 5: INSTALLED with pending final balance
    {
      customerName: 'Meera Krishnan',
      phone: '9840288771',
      city: 'Chennai',
      state: 'Tamil Nadu',
      address: '35 4th Cross, Gandhi Nagar, Adyar',
      pincode: '600020',
      kw: 3,
      type: 'ON_GRID' as SystemType,
      orderStatus: 'INSTALLED' as OrderStatus,
      total: 198000,
      paid: 140000,
      paymentMethod: 'BANK_TRANSFER' as const,
      paymentRef: 'RTGS-HDFC-991820',
      installedDaysAgo: 3,
      techId: tech2.id,
    },
    // Order 6: COMPLETED full balance paid, invoice marked PAID
    {
      customerName: 'Naveen Jindal',
      phone: '9818044332',
      city: 'Faridabad',
      state: 'Haryana',
      address: 'Sector 15A',
      pincode: '121007',
      kw: 5,
      type: 'ON_GRID' as SystemType,
      orderStatus: 'COMPLETED' as OrderStatus,
      total: 320000,
      paid: 320000,
      paymentMethod: 'CASH' as const,
      paymentRef: 'CR-OFFICE-8841',
      installedDaysAgo: 10,
      techId: tech1.id,
    },
  ];

  for (const o of ordersSetup) {
    const cust = await prisma.customer.upsert({
      where: { phone: o.phone },
      update: {},
      create: {
        name: o.customerName,
        phone: o.phone,
        address: o.address,
        city: o.city,
        state: o.state,
        pincode: o.pincode,
        monthlyBill: o.kw * 1800,
        roofAreaSqft: o.kw * 220,
      },
    });

    const existingOrder = await prisma.order.findFirst({ where: { customerId: cust.id } });
    if (existingOrder) {
      console.log(`   ↷ Order already exists for ${cust.name}`);
      continue;
    }

    leadSeq += 1;
    const lead = await prisma.lead.create({
      data: {
        reference: `SP-L-${year}-${pad(leadSeq)}`,
        customerId: cust.id,
        requestedKw: o.kw,
        systemType: o.type,
        status: o.orderStatus === 'COMPLETED' ? 'WON' : 'WON',
        source: 'WEB_FORM',
        assignedToId: sales.id,
        monthlyBill: o.kw * 1800,
        roofAreaSqft: o.kw * 220,
        notes: `Order for ${o.kw}kW system in ${o.city}.`,
      },
    });

    quoteSeq += 1;
    const quote = await prisma.quote.create({
      data: {
        quoteNumber: `SP-Q-${year}-${pad(quoteSeq)}`,
        leadId: lead.id,
        customerId: cust.id,
        systemType: o.type,
        capacityKw: o.kw,
        subtotal: o.total - Math.round(o.total * 0.138),
        discount: 0,
        taxRate: 13.8,
        taxAmount: Math.round(o.total * 0.138),
        total: o.total,
        advanceAmount: Math.round(o.total * 0.3),
        status: 'ACCEPTED',
        publicToken: `token-${cust.name.toLowerCase().replace(/\s+/g, '-')}-${o.kw}kw`,
        createdById: sales.id,
      },
    });

    orderSeq += 1;
    const order = await prisma.order.create({
      data: {
        orderNumber: `SP-O-${year}-${pad(orderSeq)}`,
        quoteId: quote.id,
        leadId: lead.id,
        customerId: cust.id,
        status: o.orderStatus,
        total: o.total,
        advancePaid: o.paid,
        balanceDue: o.total - o.paid,
        approvedById: o.paid > 0 ? director.id : undefined,
        approvedAt: o.paid > 0 ? daysAgo(5) : undefined,
        dispatchAt: (o as any).dispatchedDaysAgo ? daysAgo((o as any).dispatchedDaysAgo) : undefined,
        installedAt: (o as any).installedDaysAgo ? daysAgo((o as any).installedDaysAgo) : undefined,
        completedAt: o.orderStatus === 'COMPLETED' ? daysAgo(2) : undefined,
      },
    });

    // Populate kit items for this order
    const invProduct = prodMap.get(`INV-${o.kw}K`);
    const panelProduct = prodMap.get('PANEL-540W');
    const strProduct = prodMap.get(`STR-${o.kw}K`);

    if (invProduct) {
      await prisma.kitItem.create({
        data: {
          orderId: order.id,
          productId: invProduct.id,
          quantity: 1,
          packed: (o as any).packProgress ? (o as any).packProgress >= 50 : ['DISPATCHED', 'INSTALLED', 'COMPLETED'].includes(o.orderStatus),
          packedAt: ['DISPATCHED', 'INSTALLED', 'COMPLETED'].includes(o.orderStatus) ? daysAgo(3) : undefined,
        },
      });
    }

    if (panelProduct) {
      const panelQty = Math.ceil((o.kw * 1000) / 540);
      await prisma.kitItem.create({
        data: {
          orderId: order.id,
          productId: panelProduct.id,
          quantity: panelQty,
          packed: ['DISPATCHED', 'INSTALLED', 'COMPLETED'].includes(o.orderStatus),
          packedAt: ['DISPATCHED', 'INSTALLED', 'COMPLETED'].includes(o.orderStatus) ? daysAgo(3) : undefined,
        },
      });
    }

    if (strProduct) {
      await prisma.kitItem.create({
        data: {
          orderId: order.id,
          productId: strProduct.id,
          quantity: 1,
          packed: ['DISPATCHED', 'INSTALLED', 'COMPLETED'].includes(o.orderStatus),
        },
      });
    }

    // Link assigned inventory unit if dispatched or installed
    if (invProduct && ['DISPATCHED', 'INSTALLED', 'COMPLETED'].includes(o.orderStatus)) {
      const dispatchDate = (o as any).dispatchedDaysAgo ? daysAgo((o as any).dispatchedDaysAgo) : daysAgo(3);
      await prisma.inventoryUnit.create({
        data: {
          productId: invProduct.id,
          serialNumber: `SN-INV-${o.kw}K-ORD-${pad(orderSeq)}`,
          status: o.orderStatus === 'DISPATCHED' ? 'DISPATCHED' : 'INSTALLED',
          orderId: order.id,
          dispatchedAt: dispatchDate,
          installedAt: (o as any).installedDaysAgo ? daysAgo((o as any).installedDaysAgo) : undefined,
          warrantyStart: dispatchDate,
          warrantyEnd: new Date(dispatchDate.getTime() + 60 * 30 * 24 * 60 * 60 * 1000), // 5 years
        },
      });
    }

    // Payment creation
    if (o.paid > 0) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: o.paid,
          method: (o as any).paymentMethod ?? 'BANK_TRANSFER',
          type: o.paid === o.total ? 'FULL' : 'ADVANCE',
          status: 'APPROVED',
          reference: (o as any).paymentRef ?? 'OFFICE-REC-01',
          submittedById: sales.id,
          approvedById: director.id,
          approvedAt: daysAgo(4),
          createdAt: daysAgo(5),
        },
      });
    }

    // If pending payment screenshot waiting for approval
    if ((o as any).hasPendingPayment) {
      await prisma.payment.create({
        data: {
          orderId: order.id,
          amount: (o as any).paymentAmount,
          method: 'UPI',
          type: 'ADVANCE',
          status: 'PENDING',
          reference: (o as any).paymentRef,
          notes: 'Customer transferred via Google Pay QR code. Office approval required to release crate packing.',
          screenshotUrl: '/demo/payment-screenshot-sample.png',
          submittedById: sales.id,
          createdAt: daysAgo(1),
        },
      });
    }

    // Invoice
    invoiceSeq += 1;
    await prisma.invoice.create({
      data: {
        invoiceNumber: `SP-INV-${year}-${pad(invoiceSeq)}`,
        customerId: cust.id,
        orderId: order.id,
        type: 'SALES',
        subtotal: o.total - Math.round(o.total * 0.138),
        taxRate: 13.8,
        taxAmount: Math.round(o.total * 0.138),
        total: o.total,
        status: o.orderStatus === 'COMPLETED' ? 'PAID' : 'SENT',
        paidAt: o.orderStatus === 'COMPLETED' ? daysAgo(2) : undefined,
        createdById: sales.id,
      },
    });

    // PM Surya Ghar Subsidy Record
    await prisma.subsidyRecord.create({
      data: {
        customerId: cust.id,
        orderId: order.id,
        scheme: 'PM Surya Ghar Muft Bijli Yojana',
        status: o.orderStatus === 'COMPLETED' ? 'DISBURSED' : o.orderStatus === 'INSTALLED' ? 'APPROVED' : 'SUBMITTED',
        amount: o.kw >= 3 ? 78000 : o.kw === 2 ? 60000 : 30000,
        applicationNumber: `PMSG-${year}-${pad(1000 + orderSeq)}`,
      },
    });

    // Job creation for dispatched/installed
    if ((o as any).techId) {
      jobSeq += 1;
      await prisma.job.create({
        data: {
          jobNumber: `SP-J-${year}-${pad(jobSeq)}`,
          orderId: order.id,
          leadId: lead.id,
          customerId: cust.id,
          type: 'INSTALLATION',
          status: ['INSTALLED', 'COMPLETED'].includes(o.orderStatus) ? 'COMPLETED' : 'SCHEDULED',
          technicianId: (o as any).techId,
          scheduledDate: (o as any).installedDaysAgo ? daysAgo((o as any).installedDaysAgo) : daysFromNow(2),
          scheduledSlot: '09:00 - 13:00',
          completedAt: ['INSTALLED', 'COMPLETED'].includes(o.orderStatus) ? daysAgo((o as any).installedDaysAgo ?? 2) : undefined,
          notes: `Installation for ${cust.name}. Elevated mounting structure and earthing pit.`,
        },
      });
    }

    console.log(`   ✓ Order created: ${order.orderNumber} (${o.orderStatus}) - ₹${o.total.toLocaleString('en-IN')}`);
  }

  // 4. WARRANTY SUPPORT TICKETS
  console.log('🛠️ Generating service & warranty tickets...');
  const ticketsData = [
    {
      issue: 'Inverter error code E04 (over-temperature shutdown at noon)',
      faultCode: 'ERR_E04',
      priority: 'HIGH' as TicketPriority,
      status: 'OPEN' as TicketStatus,
      warrantyStatus: 'IN_WARRANTY' as const,
      billable: false,
      notes: 'Customer noticed inverter cooling fan is not spinning when internal temperature reaches 65C.',
    },
    {
      issue: 'Solar generation drop of 35% compared to previous month',
      faultCode: 'PERF_DROP',
      priority: 'MEDIUM' as TicketPriority,
      status: 'IN_PROGRESS' as TicketStatus,
      warrantyStatus: 'IN_WARRANTY' as const,
      billable: false,
      notes: 'Technician Arun scheduled for string voltage audit and thermal imaging of MC4 connectors.',
      techId: tech1.id,
    },
    {
      issue: 'WiFi smart monitoring datalogger offline in mobile application',
      faultCode: 'WIFI_COMM',
      priority: 'LOW' as TicketPriority,
      status: 'RESOLVED' as TicketStatus,
      warrantyStatus: 'IN_WARRANTY' as const,
      billable: false,
      notes: 'Reconfigured home router IP subnet and updated inverter WiFi stick firmware to v2.4.1.',
      techId: tech2.id,
    },
    {
      issue: 'Physical cable conduit damaged during terrace waterproofing work',
      faultCode: 'PHYS_DAMAGE',
      priority: 'MEDIUM' as TicketPriority,
      status: 'CLOSED' as TicketStatus,
      warrantyStatus: 'OUT_OF_WARRANTY' as const,
      billable: true,
      laborCharge: 1200,
      partsCharge: 1800,
      totalCharge: 3000,
      notes: 'Replaced 12m UV-resistant flexible conduit and re-terminated DC cable lines.',
      techId: tech1.id,
    },
  ];

  const firstCustomer = await prisma.customer.findFirst();
  const firstOrder = await prisma.order.findFirst({ where: { status: { in: ['INSTALLED', 'COMPLETED'] } } });
  const sampleProduct = prodMap.get('INV-3K') ?? products[0];

  for (const t of ticketsData) {
    ticketSeq += 1;
    await prisma.ticket.create({
      data: {
        ticketNumber: `SP-T-${year}-${pad(ticketSeq)}`,
        customerId: firstCustomer?.id ?? 'cust-demo',
        orderId: firstOrder?.id,
        productId: sampleProduct?.id,
        issue: t.issue,
        faultCode: t.faultCode,
        priority: t.priority,
        status: t.status,
        warrantyStatus: t.warrantyStatus,
        billable: t.billable,
        laborCharge: (t as any).laborCharge ?? 0,
        partsCharge: (t as any).partsCharge ?? 0,
        totalCharge: (t as any).totalCharge ?? 0,
        assignedToId: (t as any).techId ?? support.id,
        resolution: t.status === 'RESOLVED' || t.status === 'CLOSED' ? t.notes : undefined,
        resolvedAt: t.status === 'RESOLVED' || t.status === 'CLOSED' ? daysAgo(1) : undefined,
        closedAt: t.status === 'CLOSED' ? daysAgo(1) : undefined,
        createdAt: daysAgo(4),
      },
    });
    console.log(`   ✓ Support Ticket created: SP-T-${year}-${pad(ticketSeq)} (${t.status}) - ${t.faultCode}`);
  }

  // 5. OPERATIONAL EXPENSES
  console.log('💰 Generating operational expenses...');
  const expensesData = [
    { category: 'Logistics', description: 'Tempo transport for 5kW Solar kit delivery (Faridabad)', amount: 3500 },
    { category: 'Safety Equipment', description: 'Double lanyard fall arrest harness & safety helmets (x4)', amount: 5800 },
    { category: 'DISCOM Liaison', description: 'Net-meter testing and inspection charges (DHBVN)', amount: 2500 },
    { category: 'Site Supplies', description: 'Chemical earthing compound and copper bonding strips', amount: 4200 },
    { category: 'Vehicle Fuel', description: 'Site survey vehicle diesel reimbursement (Arun Patel)', amount: 2200 },
    { category: 'Hardware Consumables', description: 'SS-304 fastener bolts, mid-clamps, end-clamps bulk carton', amount: 6400 },
  ];

  for (const exp of expensesData) {
    await prisma.expense.create({
      data: {
        category: exp.category,
        description: exp.description,
        amount: exp.amount,
        createdById: sales.id,
        date: daysAgo(Math.floor(Math.random() * 10) + 1),
      },
    });
  }
  console.log(`   ✓ Created ${expensesData.length} operational expenses.`);

  console.log('\n✨ Database successfully populated with massive rich business data!');
}

run()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
