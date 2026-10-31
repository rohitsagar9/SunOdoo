import bcrypt from 'bcryptjs';
import type {
  InventoryUnit,
  JobStatus,
  Lead,
  OrderStatus,
  Product,
  ProductCategory,
  Quote,
  QuoteItem,
  QuoteStatus,
  Role,
  SubsidyStatus,
  SystemType,
  Job,
} from '@prisma/client';
import { prisma } from '../src/lib/prisma.js';
import { priceBom } from '../src/services/bom.js';
import catalog from '../src/catalog/products.json';

const now = new Date();
const year = now.getFullYear();
const pad = (value: number, size = 4) => String(value).padStart(size, '0');
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const monthsAgo = (months: number) => {
  return new Date(now.getFullYear(), now.getMonth() - months, 1, 12, 0, 0);
};
const addMonths = (date: Date, months: number) => {
  const result = new Date(date);
  result.setMonth(result.getMonth() + months);
  return result;
};

let leadSeq = 0;
let quoteSeq = 0;
let orderSeq = 0;
let jobSeq = 0;
let ticketSeq = 0;
let invoiceSeq = 0;

const folderMap: Record<string, string> = {
  PANEL: 'panels',
  INVERTER: 'inverters',
  BATTERY: 'batteries',
  CHARGE_CONTROLLER: 'charge-controllers',
  STRUCTURE: 'structures',
  CABLE: 'cables',
  BOS: 'bos',
  SERVICE: 'services',
  TOOL: 'tools',
};

const productMap = new Map<string, Product>();
const productsBySku = new Map<string, Product>();

async function reset() {
  await prisma.auditLog.deleteMany();
  await prisma.ticketUpdate.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.timeLog.deleteMany();
  await prisma.jobPhoto.deleteMany();
  await prisma.jobSignature.deleteMany();
  await prisma.kitItem.deleteMany();
  await prisma.inventoryUnit.deleteMany();
  await prisma.job.deleteMany();
  await prisma.ticket.deleteMany();
  await prisma.order.deleteMany();
  await prisma.quoteItem.deleteMany();
  await prisma.quote.deleteMany();
  await prisma.survey.deleteMany();
  await prisma.lead.deleteMany();
  await prisma.subsidyRecord.deleteMany();
  await prisma.customer.deleteMany();
  await prisma.product.deleteMany();
  await prisma.user.deleteMany();
}

async function seedUsers() {
  const passwordHash = await bcrypt.hash('SunPower@123', 10);
  const users: Array<{ name: string; email: string; role: Role; phone: string }> = [
    { name: 'Aditya Mehta', email: 'director@sunpower.in', role: 'DIRECTOR', phone: '9000000001' },
    { name: 'Priya Sharma', email: 'sales@sunpower.in', role: 'SALES', phone: '9000000002' },
    { name: 'Arun Kumar', email: 'tech@sunpower.in', role: 'TECHNICIAN', phone: '9000000003' },
    { name: 'Vikram Singh', email: 'tech2@sunpower.in', role: 'TECHNICIAN', phone: '9000000004' },
    { name: 'Ravi Patel', email: 'warehouse@sunpower.in', role: 'WAREHOUSE', phone: '9000000005' },
    { name: 'Meera Nair', email: 'support@sunpower.in', role: 'SUPPORT', phone: '9000000006' },
  ];

  const created: Record<string, { id: string; name: string; email: string; role: Role }> = {};
  for (const user of users) {
    const record = await prisma.user.create({
      data: { ...user, passwordHash },
    });
    created[user.role === 'TECHNICIAN' && user.email === 'tech2@sunpower.in' ? 'TECHNICIAN_2' : user.role] = {
      id: record.id,
      name: record.name,
      email: record.email,
      role: record.role,
    };
  }
  return created;
}

async function seedProducts() {
  for (const item of catalog) {
    const category = item.category as ProductCategory;
    const product = await prisma.product.create({
      data: {
        sku: item.sku,
        name: item.name,
        category,
        unit: item.unit,
        unitPrice: item.unitPrice,
        costPrice: item.costPrice,
        warrantyMonths: item.warrantyMonths,
        capacityKw: item.capacityKw,
        description: item.description,
        barcodePath: `/barcodes/${folderMap[category]}/${item.sku}.svg`,
      },
    });
    productMap.set(product.id, product);
    productsBySku.set(product.sku, product);
  }
}

async function seedStock() {
  const stockPlan: Record<string, number> = {
    'PANEL-540W': 90,
    'INV-1K': 4,
    'INV-2K': 4,
    'INV-3K': 6,
    'INV-4K': 4,
    'INV-5K': 4,
    'BAT-2.4K': 4,
    'BAT-5K': 4,
    'CC-60A': 8,
    'ACDB-3K': 6,
    'DCDB-3K': 6,
    'EARTH-KIT': 6,
    'LA-KIT': 6,
    'STR-1K': 4,
    'STR-2K': 4,
    'STR-3K': 4,
    'STR-4K': 4,
    'STR-5K': 4,
  };

  for (const [sku, count] of Object.entries(stockPlan)) {
    const product = productsBySku.get(sku);
    if (!product) continue;
    await prisma.inventoryUnit.createMany({
      data: Array.from({ length: count }, (_, index) => ({
        productId: product.id,
        serialNumber: `SN-${sku}-STK-${pad(index + 1)}`,
        status: 'IN_STOCK',
        warehouseLocation: 'Main warehouse · Rack A',
      })),
    });
  }

  for (const product of productMap.values()) {
    if (product.category !== 'TOOL') continue;
    await prisma.inventoryUnit.create({
      data: {
        productId: product.id,
        serialNumber: `SN-${product.sku}-CREW-0001`,
        status: 'IN_STOCK',
        warehouseLocation: 'Tool crib · Rack T',
      },
    });
  }
}

async function createCustomer(data: {
  name: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  monthlyBill: number;
  roofAreaSqft: number;
  email?: string;
}) {
  return prisma.customer.create({ data });
}

async function createLead(data: {
  customerId: string;
  requestedKw: number;
  systemType: SystemType;
  status: Lead['status'];
  source: Lead['source'];
  assignedToId: string;
  monthlyBill: number;
  roofAreaSqft: number;
  notes?: string;
  lostReason?: string;
  createdAt?: Date;
}) {
  leadSeq += 1;
  return prisma.lead.create({
    data: {
      ...data,
      reference: `SP-L-${year}-${pad(leadSeq)}`,
      createdAt: data.createdAt,
    },
  });
}

type QuoteWithItems = Quote & { items: QuoteItem[] };

async function createQuote(
  lead: Lead,
  options: {
    status: QuoteStatus;
    token: string;
    createdAt: Date;
    leadStatus?: Lead['status'];
    discount?: number;
  },
): Promise<QuoteWithItems> {
  quoteSeq += 1;
  const priced = await priceBom(lead.requestedKw, lead.systemType, options.discount ?? 0);
  const quote = await prisma.quote.create({
    data: {
      quoteNumber: `SP-Q-${year}-${pad(quoteSeq)}`,
      leadId: lead.id,
      customerId: lead.customerId,
      systemType: lead.systemType,
      capacityKw: lead.requestedKw,
      subtotal: priced.subtotal,
      discount: priced.discount,
      taxRate: priced.taxRate,
      taxAmount: priced.taxAmount,
      total: priced.total,
      advanceAmount: priced.advanceAmount,
      status: options.status,
      validUntil: new Date(options.createdAt.getTime() + 14 * 24 * 60 * 60 * 1000),
      publicToken: options.token,
      createdById: (await prisma.user.findFirstOrThrow({ where: { role: 'SALES' } })).id,
      createdAt: options.createdAt,
      items: { create: priced.items },
    },
    include: { items: true },
  });

  await prisma.lead.update({
    where: { id: lead.id },
    data: { status: options.leadStatus ?? 'QUOTED' },
  });

  return quote;
}

async function createOrder(
  quote: QuoteWithItems,
  options: {
    status: OrderStatus;
    createdAt: Date;
    approvedAt?: Date;
    dispatchAt?: Date;
    installedAt?: Date;
    completedAt?: Date;
    paid: number;
    paymentStatus?: 'APPROVED' | 'PENDING';
    paymentScreenshot?: string;
    job?: {
      technicianId: string;
      scheduledDate: Date;
      status: JobStatus;
      hours?: number;
      completedAt?: Date;
      slot?: string;
      notes?: string;
    };
    allocate?: 'none' | 'scanned' | 'installed';
    warrantyStart?: Date;
    packSome?: number;
  },
) {
  orderSeq += 1;
  const hardware = quote.items.filter(
    (item) => item.productId && !['SERVICE', 'TOOL'].includes(item.category),
  );
  const order = await prisma.order.create({
    data: {
      orderNumber: `SP-O-${year}-${pad(orderSeq)}`,
      quoteId: quote.id,
      leadId: quote.leadId,
      customerId: quote.customerId,
      status: options.status,
      total: quote.total,
      advancePaid: options.paid,
      balanceDue: quote.total - options.paid,
      approvedById: options.paid > 0 ? (await prisma.user.findFirstOrThrow({ where: { role: 'SALES' } })).id : undefined,
      approvedAt: options.paid > 0 ? options.approvedAt : undefined,
      dispatchAt: options.dispatchAt,
      installedAt: options.installedAt,
      completedAt: options.completedAt,
      createdAt: options.createdAt,
      kitItems: {
        create: hardware.map((item, index) => ({
          productId: item.productId!,
          quantity: item.quantity,
          packed: options.packSome === undefined ? true : index < options.packSome,
          packedAt: options.packSome === undefined || index < options.packSome ? options.createdAt : undefined,
        })),
      },
    },
    include: { kitItems: true },
  });

  if (options.paid > 0) {
    const sales = await prisma.user.findFirstOrThrow({ where: { role: 'SALES' } });
    await prisma.payment.create({
      data: {
        orderId: order.id,
        amount: options.paid,
        method: 'UPI',
        type: options.paid >= quote.total ? 'FULL' : 'ADVANCE',
        status: options.paymentStatus ?? 'APPROVED',
        screenshotUrl: options.paymentScreenshot ?? '/demo/payment-proof.svg',
        reference: `UPI/${year}/${pad(orderSeq)}${pad(quoteSeq)}`,
        submittedById: sales.id,
        approvedById: (options.paymentStatus ?? 'APPROVED') === 'APPROVED' ? sales.id : undefined,
        approvedAt: (options.paymentStatus ?? 'APPROVED') === 'APPROVED' ? options.approvedAt : undefined,
        createdAt: options.approvedAt ?? options.createdAt,
      },
    });
  }

  let job: Job | null = null;
  if (options.job) {
    jobSeq += 1;
    job = await prisma.job.create({
      data: {
        jobNumber: `SP-J-${year}-${pad(jobSeq)}`,
        orderId: order.id,
        leadId: order.leadId,
        customerId: order.customerId,
        type: 'INSTALLATION',
        status: options.job.status,
        technicianId: options.job.technicianId,
        scheduledDate: options.job.scheduledDate,
        scheduledSlot: options.job.slot ?? '09:00 - 13:00',
        hoursWorked: options.job.hours,
        completedAt: options.job.completedAt,
        clockInAt: options.job.hours ? options.job.scheduledDate : undefined,
        clockOutAt: options.job.hours
          ? new Date(options.job.scheduledDate.getTime() + options.job.hours * 60 * 60 * 1000)
          : undefined,
        completionNotes: options.job.notes,
      },
    });

    if (options.job.status === 'COMPLETED') {
      await prisma.jobSignature.create({
        data: {
          jobId: job.id,
          signerName: quote.customerId ? 'Customer' : 'Customer',
          dataUrl: '/demo/signature.svg',
          signedAt: options.job.completedAt ?? options.job.scheduledDate,
        },
      });
      await prisma.jobPhoto.createMany({
        data: [
          {
            jobId: job.id,
            url: '/demo/roof-photo.svg',
            caption: 'Finished rooftop array',
            createdAt: options.job.completedAt ?? options.job.scheduledDate,
          },
          {
            jobId: job.id,
            url: '/demo/roof-photo-2.svg',
            caption: 'Inverter and AC/DC boxes',
            createdAt: options.job.completedAt ?? options.job.scheduledDate,
          },
        ],
      });
      await prisma.timeLog.create({
        data: {
          jobId: job.id,
          userId: options.job.technicianId,
          clockIn: options.job.scheduledDate,
          clockOut: new Date(
            options.job.scheduledDate.getTime() + (options.job.hours ?? 6) * 60 * 60 * 1000,
          ),
          minutes: Math.round((options.job.hours ?? 6) * 60),
          notes: 'Installation, testing and customer handover.',
        },
      });
    }
  }

  let units: InventoryUnit[] = [];
  if (options.allocate && options.allocate !== 'none') {
    units = await allocateUnits(
      order.id,
      quote,
      options.allocate,
      options.warrantyStart ?? options.installedAt ?? options.dispatchAt ?? now,
    );
  }

  return { order, job, units };
}

async function allocateUnits(
  orderId: string,
  quote: QuoteWithItems,
  mode: 'scanned' | 'installed',
  warrantyStart: Date,
) {
  const allocated: InventoryUnit[] = [];
  const hardware = quote.items.filter(
    (item) => item.productId && !['SERVICE', 'TOOL'].includes(item.category),
  );

  for (const item of hardware) {
    const product = productMap.get(item.productId!);
    if (!product) continue;

    let units = await prisma.inventoryUnit.findMany({
      where: { productId: product.id, status: 'IN_STOCK' },
      take: item.quantity,
    });

    if (units.length < item.quantity) {
      const missing = item.quantity - units.length;
      await prisma.inventoryUnit.createMany({
        data: Array.from({ length: missing }, (_, index) => ({
          productId: product.id,
          serialNumber: `SN-${product.sku}-ORD-${pad(orderSeq)}-${pad(index + 1)}`,
          status: 'IN_STOCK',
          warehouseLocation: 'Main warehouse · Rack B',
        })),
      });
      units = await prisma.inventoryUnit.findMany({
        where: { productId: product.id, status: 'IN_STOCK' },
        take: item.quantity,
      });
    }

    for (const unit of units.slice(0, item.quantity)) {
      const updated = await prisma.inventoryUnit.update({
        where: { id: unit.id },
        data: {
          orderId,
          status: mode === 'installed' ? 'INSTALLED' : 'DISPATCHED',
          dispatchedAt: warrantyStart,
          installedAt: mode === 'installed' ? warrantyStart : undefined,
          warrantyStart,
          warrantyEnd: addMonths(warrantyStart, product.warrantyMonths),
        },
      });
      allocated.push(updated);
    }
  }

  return allocated;
}

async function createSurvey(
  leadId: string,
  options: {
    technicianId: string;
    scheduledAt: Date;
    completedAt?: Date;
    approved: boolean;
    roofDirection?: string;
    tiltDegrees?: number;
    cableDistanceM?: number;
    shadowFreeAreaSqft?: number;
    findings?: string;
  },
) {
  return prisma.survey.create({ data: { leadId, ...options } });
}

async function createInvoice(options: {
  customerId: string;
  orderId?: string;
  ticketId?: string;
  type: 'SALES' | 'REPAIR';
  subtotal: number;
  taxRate: number;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE';
  createdAt: Date;
  paidAt?: Date;
}) {
  invoiceSeq += 1;
  const taxAmount = Math.round(options.subtotal * (options.taxRate / 100));
  return prisma.invoice.create({
    data: {
      invoiceNumber: `SP-INV-${year}-${pad(invoiceSeq)}`,
      customerId: options.customerId,
      orderId: options.orderId,
      ticketId: options.ticketId,
      type: options.type,
      subtotal: options.subtotal,
      taxRate: options.taxRate,
      taxAmount,
      total: options.subtotal + taxAmount,
      status: options.status,
      dueDate: new Date(options.createdAt.getTime() + 7 * 24 * 60 * 60 * 1000),
      paidAt: options.paidAt,
      createdById: (await prisma.user.findFirstOrThrow({ where: { role: 'SALES' } })).id,
      createdAt: options.createdAt,
    },
  });
}

async function main() {
  console.log('Cleaning existing demo data…');
  await reset();

  console.log('Creating staff accounts…');
  const users = await seedUsers();

  console.log('Creating product catalogue and stock…');
  await seedProducts();
  await seedStock();

  const sales = users.SALES;
  const director = users.DIRECTOR;
  const tech = users.TECHNICIAN;
  const tech2 = users.TECHNICIAN_2;
  const warehouse = users.WAREHOUSE;
  const support = users.SUPPORT;

  console.log('Creating customers and leads…');
  const ananya = await createCustomer({
    name: 'Ananya Sharma',
    phone: '9876543210',
    email: 'ananya.sharma@example.com',
    address: '12 Palm Grove, Indiranagar',
    city: 'Bengaluru',
    state: 'Karnataka',
    pincode: '560034',
    monthlyBill: 4200,
    roofAreaSqft: 650,
  });
  const rajesh = await createCustomer({
    name: 'Rajesh Kumar',
    phone: '9876543211',
    email: 'rajesh.kumar@example.com',
    address: '44 Lake View, Gachibowli',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500081',
    monthlyBill: 9500,
    roofAreaSqft: 1200,
  });
  const fatima = await createCustomer({
    name: 'Fatima Khan',
    phone: '9876543212',
    address: '7 Rose Villa, Koregaon Park',
    city: 'Pune',
    state: 'Maharashtra',
    pincode: '411001',
    monthlyBill: 2800,
    roofAreaSqft: 480,
  });
  const suresh = await createCustomer({
    name: 'Suresh Patel',
    phone: '9876543213',
    address: '21 MG Road, Navrangpura',
    city: 'Ahmedabad',
    state: 'Gujarat',
    pincode: '380009',
    monthlyBill: 6100,
    roofAreaSqft: 900,
  });
  const meenakshi = await createCustomer({
    name: 'Meenakshi Iyer',
    phone: '9876543214',
    address: '9 Temple Street, Mylapore',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600028',
    monthlyBill: 7200,
    roofAreaSqft: 1000,
  });
  const david = await createCustomer({
    name: 'David Fernandes',
    phone: '9876543215',
    address: '18 Hill Road, Bandra West',
    city: 'Mumbai',
    state: 'Maharashtra',
    pincode: '400050',
    monthlyBill: 5400,
    roofAreaSqft: 780,
  });
  const pooja = await createCustomer({
    name: 'Pooja Reddy',
    phone: '9876543216',
    address: '33 Jubilee Hills, Road No. 36',
    city: 'Hyderabad',
    state: 'Telangana',
    pincode: '500033',
    monthlyBill: 11000,
    roofAreaSqft: 1400,
  });
  const arjun = await createCustomer({
    name: 'Arjun Nair',
    phone: '9876543217',
    address: '5 Green Park, Kadavanthra',
    city: 'Kochi',
    state: 'Kerala',
    pincode: '682016',
    monthlyBill: 6800,
    roofAreaSqft: 950,
  });
  const lakshmi = await createCustomer({
    name: 'Lakshmi Narayan',
    phone: '9876543218',
    address: '27 Gandhi Nagar, Ramanathapuram',
    city: 'Coimbatore',
    state: 'Tamil Nadu',
    pincode: '641001',
    monthlyBill: 3900,
    roofAreaSqft: 620,
  });
  const imran = await createCustomer({
    name: 'Imran Sheikh',
    phone: '9876543219',
    address: '61 Market Road, Aminabad',
    city: 'Lucknow',
    state: 'Uttar Pradesh',
    pincode: '226001',
    monthlyBill: 2100,
    roofAreaSqft: 350,
  });
  const naveen = await createCustomer({
    name: 'Naveen Rao',
    phone: '9876543220',
    address: '14 Cyber City, Tower B',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122002',
    monthlyBill: 12500,
    roofAreaSqft: 1600,
  });
  const kavita = await createCustomer({
    name: 'Kavita Joshi',
    phone: '9876543221',
    address: '8 Lake Town, Block A',
    city: 'Kolkata',
    state: 'West Bengal',
    pincode: '700089',
    monthlyBill: 4600,
    roofAreaSqft: 700,
  });
  const ramesh = await createCustomer({
    name: 'Ramesh Gupta',
    phone: '9876543222',
    address: '3 Old Colony, Bani Park',
    city: 'Jaipur',
    state: 'Rajasthan',
    pincode: '302001',
    monthlyBill: 5100,
    roofAreaSqft: 800,
  });
  const rohit = await createCustomer({
    name: 'Rohit Verma',
    phone: '9876543223',
    email: 'rohit.verma@example.com',
    address: '22 Sector 45, Golf Course Road',
    city: 'Gurugram',
    state: 'Haryana',
    pincode: '122003',
    monthlyBill: 14200,
    roofAreaSqft: 1750,
  });

  const leadAnanya = await createLead({
    customerId: ananya.id,
    requestedKw: 3,
    systemType: 'ON_GRID',
    status: 'NEW',
    source: 'WEB_FORM',
    assignedToId: sales.id,
    monthlyBill: 4200,
    roofAreaSqft: 650,
    notes: 'Wants subsidy paperwork handled by SunPower.',
    createdAt: daysAgo(0),
  });
  const leadRajesh = await createLead({
    customerId: rajesh.id,
    requestedKw: 5,
    systemType: 'OFF_GRID',
    status: 'VERIFIED',
    source: 'WHATSAPP',
    assignedToId: sales.id,
    monthlyBill: 9500,
    roofAreaSqft: 1200,
    notes: 'Frequent power cuts; battery backup is a priority.',
    createdAt: daysAgo(1),
  });
  const leadFatima = await createLead({
    customerId: fatima.id,
    requestedKw: 2,
    systemType: 'ON_GRID',
    status: 'SURVEY_SCHEDULED',
    source: 'WEB_FORM',
    assignedToId: sales.id,
    monthlyBill: 2800,
    roofAreaSqft: 480,
    createdAt: daysAgo(2),
  });
  const leadSuresh = await createLead({
    customerId: suresh.id,
    requestedKw: 3,
    systemType: 'OFF_GRID',
    status: 'SURVEY_COMPLETED',
    source: 'WEB_FORM',
    assignedToId: sales.id,
    monthlyBill: 6100,
    roofAreaSqft: 900,
    notes: 'Survey approved. Ready for quote.',
    createdAt: daysAgo(4),
  });
  const leadMeenakshi = await createLead({
    customerId: meenakshi.id,
    requestedKw: 4,
    systemType: 'ON_GRID',
    status: 'QUOTED',
    source: 'PHONE',
    assignedToId: sales.id,
    monthlyBill: 7200,
    roofAreaSqft: 1000,
    createdAt: daysAgo(6),
  });
  const leadDavid = await createLead({
    customerId: david.id,
    requestedKw: 3,
    systemType: 'ON_GRID',
    status: 'WON',
    source: 'WEB_FORM',
    assignedToId: sales.id,
    monthlyBill: 5400,
    roofAreaSqft: 780,
    createdAt: daysAgo(8),
  });
  const leadPooja = await createLead({
    customerId: pooja.id,
    requestedKw: 5,
    systemType: 'ON_GRID',
    status: 'WON',
    source: 'WEB_FORM',
    assignedToId: sales.id,
    monthlyBill: 11000,
    roofAreaSqft: 1400,
    createdAt: daysAgo(12),
  });
  const leadArjun = await createLead({
    customerId: arjun.id,
    requestedKw: 3,
    systemType: 'OFF_GRID',
    status: 'WON',
    source: 'PHONE',
    assignedToId: sales.id,
    monthlyBill: 6800,
    roofAreaSqft: 950,
    createdAt: daysAgo(42),
  });
  const leadLakshmi = await createLead({
    customerId: lakshmi.id,
    requestedKw: 2,
    systemType: 'ON_GRID',
    status: 'WON',
    source: 'WEB_FORM',
    assignedToId: sales.id,
    monthlyBill: 3900,
    roofAreaSqft: 620,
    createdAt: daysAgo(10),
  });
  const leadImran = await createLead({
    customerId: imran.id,
    requestedKw: 1,
    systemType: 'ON_GRID',
    status: 'LOST',
    source: 'WEB_FORM',
    assignedToId: sales.id,
    monthlyBill: 2100,
    roofAreaSqft: 350,
    lostReason: 'Roof has heavy shading and no suitable grid connection.',
    createdAt: daysAgo(15),
  });
  const leadNaveen = await createLead({
    customerId: naveen.id,
    requestedKw: 4,
    systemType: 'ON_GRID',
    status: 'WON',
    source: 'PHONE',
    assignedToId: sales.id,
    monthlyBill: 12500,
    roofAreaSqft: 1600,
    createdAt: daysAgo(80),
  });
  const leadKavita = await createLead({
    customerId: kavita.id,
    requestedKw: 2,
    systemType: 'OFF_GRID',
    status: 'WON',
    source: 'WEB_FORM',
    assignedToId: sales.id,
    monthlyBill: 4600,
    roofAreaSqft: 700,
    createdAt: daysAgo(105),
  });
  const leadRamesh = await createLead({
    customerId: ramesh.id,
    requestedKw: 3,
    systemType: 'ON_GRID',
    status: 'WON',
    source: 'PHONE',
    assignedToId: sales.id,
    monthlyBill: 5100,
    roofAreaSqft: 800,
    createdAt: daysAgo(1110),
  });
  const leadRohit = await createLead({
    customerId: rohit.id,
    requestedKw: 5,
    systemType: 'ON_GRID',
    status: 'WON',
    source: 'PHONE',
    assignedToId: sales.id,
    monthlyBill: 14200,
    roofAreaSqft: 1750,
    notes: 'Factory rooftop. Wants net metering and subsidy support.',
    createdAt: daysAgo(55),
  });

  console.log('Creating surveys…');
  await createSurvey(leadFatima.id, {
    technicianId: tech.id,
    scheduledAt: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0),
    approved: false,
  });
  const surveySuresh = await createSurvey(leadSuresh.id, {
    technicianId: tech.id,
    scheduledAt: daysAgo(3),
    completedAt: daysAgo(3),
    approved: true,
    roofDirection: 'South-west',
    tiltDegrees: 12,
    cableDistanceM: 28,
    shadowFreeAreaSqft: 920,
    findings: 'Shadow-free from 9am to 4pm. Structure can be anchored to the RCC slab.',
  });
  await createSurvey(leadMeenakshi.id, {
    technicianId: tech.id,
    scheduledAt: daysAgo(5),
    completedAt: daysAgo(5),
    approved: true,
    roofDirection: 'South',
    tiltDegrees: 10,
    cableDistanceM: 22,
    shadowFreeAreaSqft: 1050,
    findings: 'Ideal south-facing roof. Cable run to meter room is short.',
  });
  await createSurvey(leadDavid.id, {
    technicianId: tech2.id,
    scheduledAt: daysAgo(7),
    completedAt: daysAgo(7),
    approved: true,
    roofDirection: 'South-east',
    tiltDegrees: 14,
    cableDistanceM: 30,
    shadowFreeAreaSqft: 820,
  });
  await createSurvey(leadPooja.id, {
    technicianId: tech.id,
    scheduledAt: daysAgo(10),
    completedAt: daysAgo(10),
    approved: true,
    roofDirection: 'South',
    tiltDegrees: 8,
    cableDistanceM: 18,
    shadowFreeAreaSqft: 1450,
  });
  await createSurvey(leadArjun.id, {
    technicianId: tech.id,
    scheduledAt: daysAgo(40),
    completedAt: daysAgo(40),
    approved: true,
    roofDirection: 'West',
    tiltDegrees: 15,
    cableDistanceM: 26,
    shadowFreeAreaSqft: 980,
  });
  await createSurvey(leadLakshmi.id, {
    technicianId: tech2.id,
    scheduledAt: daysAgo(9),
    completedAt: daysAgo(9),
    approved: true,
    roofDirection: 'South',
    tiltDegrees: 11,
    cableDistanceM: 20,
    shadowFreeAreaSqft: 640,
  });
  await createSurvey(leadNaveen.id, {
    technicianId: tech.id,
    scheduledAt: daysAgo(78),
    completedAt: daysAgo(78),
    approved: true,
    roofDirection: 'South-east',
    tiltDegrees: 9,
    cableDistanceM: 32,
    shadowFreeAreaSqft: 1700,
  });
  await createSurvey(leadKavita.id, {
    technicianId: tech2.id,
    scheduledAt: daysAgo(103),
    completedAt: daysAgo(103),
    approved: true,
    roofDirection: 'South',
    tiltDegrees: 13,
    cableDistanceM: 24,
    shadowFreeAreaSqft: 740,
  });
  await createSurvey(leadRamesh.id, {
    technicianId: tech.id,
    scheduledAt: daysAgo(1105),
    completedAt: daysAgo(1105),
    approved: true,
    roofDirection: 'South',
    tiltDegrees: 12,
    cableDistanceM: 25,
    shadowFreeAreaSqft: 850,
  });
  await createSurvey(leadRohit.id, {
    technicianId: tech2.id,
    scheduledAt: daysAgo(50),
    completedAt: daysAgo(50),
    approved: true,
    roofDirection: 'South-east',
    tiltDegrees: 10,
    cableDistanceM: 35,
    shadowFreeAreaSqft: 1800,
    findings: 'Large factory roof. Structure layout approved for 5 kW.',
  });

  // Survey visit for Fatima today, visible on the technician's schedule.
  jobSeq += 1;
  await prisma.job.create({
    data: {
      jobNumber: `SP-J-${year}-${pad(jobSeq)}`,
      leadId: leadFatima.id,
      customerId: fatima.id,
      type: 'SURVEY',
      status: 'SCHEDULED',
      technicianId: tech.id,
      scheduledDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 10, 0),
      scheduledSlot: '10:00 - 11:00',
      notes: 'Measure roof, check tilt, cable run and grid connection.',
    },
  });

  console.log('Creating quotes and orders…');
  const quoteMeenakshi = await createQuote(leadMeenakshi, {
    status: 'SENT',
    token: 'demo-meenakshi',
    createdAt: daysAgo(3),
  });
  const quoteDavid = await createQuote(leadDavid, {
    status: 'ACCEPTED',
    token: 'demo-david',
    createdAt: daysAgo(2),
    leadStatus: 'WON',
  });
  const quotePooja = await createQuote(leadPooja, {
    status: 'ACCEPTED',
    token: 'demo-pooja',
    createdAt: daysAgo(6),
    leadStatus: 'WON',
  });
  const quoteArjun = await createQuote(leadArjun, {
    status: 'ACCEPTED',
    token: 'demo-arjun',
    createdAt: daysAgo(41),
    leadStatus: 'WON',
  });
  const quoteLakshmi = await createQuote(leadLakshmi, {
    status: 'ACCEPTED',
    token: 'demo-lakshmi',
    createdAt: daysAgo(9),
    leadStatus: 'WON',
  });
  const quoteNaveen = await createQuote(leadNaveen, {
    status: 'ACCEPTED',
    token: 'demo-naveen',
    createdAt: daysAgo(79),
    leadStatus: 'WON',
  });
  const quoteKavita = await createQuote(leadKavita, {
    status: 'ACCEPTED',
    token: 'demo-kavita',
    createdAt: daysAgo(104),
    leadStatus: 'WON',
  });
  const quoteRamesh = await createQuote(leadRamesh, {
    status: 'ACCEPTED',
    token: 'demo-ramesh',
    createdAt: daysAgo(1109),
    leadStatus: 'WON',
  });
  const quoteRohit = await createQuote(leadRohit, {
    status: 'ACCEPTED',
    token: 'demo-rohit',
    createdAt: daysAgo(48),
    leadStatus: 'WON',
  });

  // David: quote accepted, advance screenshot waiting for office approval.
  const davidOrder = await createOrder(quoteDavid, {
    status: 'PENDING_PAYMENT',
    createdAt: daysAgo(2),
    paid: 0,
  });
  const davidAdvance = Math.round(quoteDavid.total * 0.3);
  await prisma.payment.create({
    data: {
      orderId: davidOrder.order.id,
      amount: davidAdvance,
      method: 'UPI',
      type: 'ADVANCE',
      status: 'PENDING',
      screenshotUrl: '/demo/payment-proof.svg',
      reference: `UPI/${year}/DEMO-DAVID`,
      submittedById: sales.id,
      notes: 'Customer uploaded advance payment screenshot from the quote link.',
      createdAt: daysAgo(1),
    },
  });

  // Pooja: advance approved, packing in progress, warehouse queue.
  const poojaPaid = Math.round(quotePooja.total * 0.3);
  const poojaOrder = await createOrder(quotePooja, {
    status: 'ADVANCE_PAID',
    createdAt: daysAgo(6),
    approvedAt: daysAgo(4),
    paid: poojaPaid,
    packSome: 3,
    job: {
      technicianId: tech2.id,
      scheduledDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      status: 'SCHEDULED',
      slot: '09:00 - 13:00',
      notes: '5 kW on-grid installation. Warehouse packing in progress.',
    },
  });

  // Lakshmi: dispatched, installation scheduled today.
  const lakshmiPaid = Math.round(quoteLakshmi.total * 0.3);
  const lakshmiOrder = await createOrder(quoteLakshmi, {
    status: 'DISPATCHED',
    createdAt: daysAgo(9),
    approvedAt: daysAgo(7),
    dispatchAt: daysAgo(2),
    paid: lakshmiPaid,
    allocate: 'scanned',
    warrantyStart: daysAgo(2),
    job: {
      technicianId: tech.id,
      scheduledDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 9, 0),
      status: 'SCHEDULED',
      slot: '09:00 - 13:00',
      notes: '2 kW on-grid installation. Material delivered on site.',
    },
  });

  // Arjun: completed last month, used for profit analytics and warranty.
  const arjunCompletedAt = daysAgo(12);
  const arjunOrder = await createOrder(quoteArjun, {
    status: 'COMPLETED',
    createdAt: daysAgo(42),
    approvedAt: arjunCompletedAt,
    dispatchAt: daysAgo(38),
    installedAt: arjunCompletedAt,
    completedAt: arjunCompletedAt,
    paid: quoteArjun.total,
    allocate: 'installed',
    warrantyStart: arjunCompletedAt,
    job: {
      technicianId: tech.id,
      scheduledDate: daysAgo(13),
      status: 'COMPLETED',
      hours: 7.5,
      completedAt: arjunCompletedAt,
      notes: '3 kW off-grid with battery backup. Tested backup changeover.',
    },
  });
  await createInvoice({
    customerId: arjun.id,
    orderId: arjunOrder.order.id,
    type: 'SALES',
    subtotal: Math.round(quoteArjun.total / 1.138),
    taxRate: 13.8,
    status: 'PAID',
    createdAt: arjunCompletedAt,
    paidAt: arjunCompletedAt,
  });

  // Naveen: completed two months ago.
  const naveenCompletedAt = daysAgo(65);
  const naveenOrder = await createOrder(quoteNaveen, {
    status: 'COMPLETED',
    createdAt: daysAgo(80),
    approvedAt: naveenCompletedAt,
    dispatchAt: daysAgo(72),
    installedAt: naveenCompletedAt,
    completedAt: naveenCompletedAt,
    paid: quoteNaveen.total,
    allocate: 'installed',
    warrantyStart: naveenCompletedAt,
    job: {
      technicianId: tech2.id,
      scheduledDate: daysAgo(66),
      status: 'COMPLETED',
      hours: 8,
      completedAt: naveenCompletedAt,
      notes: '4 kW on-grid. Net meter application submitted.',
    },
  });
  await createInvoice({
    customerId: naveen.id,
    orderId: naveenOrder.order.id,
    type: 'SALES',
    subtotal: Math.round(quoteNaveen.total / 1.138),
    taxRate: 13.8,
    status: 'PAID',
    createdAt: naveenCompletedAt,
    paidAt: naveenCompletedAt,
  });

  // Kavita: completed three months ago.
  const kavitaCompletedAt = daysAgo(90);
  const kavitaOrder = await createOrder(quoteKavita, {
    status: 'COMPLETED',
    createdAt: daysAgo(105),
    approvedAt: kavitaCompletedAt,
    dispatchAt: daysAgo(97),
    installedAt: kavitaCompletedAt,
    completedAt: kavitaCompletedAt,
    paid: quoteKavita.total,
    allocate: 'installed',
    warrantyStart: kavitaCompletedAt,
    job: {
      technicianId: tech.id,
      scheduledDate: daysAgo(91),
      status: 'COMPLETED',
      hours: 6,
      completedAt: kavitaCompletedAt,
      notes: '2 kW off-grid with battery. Customer trained on changeover.',
    },
  });
  await createInvoice({
    customerId: kavita.id,
    orderId: kavitaOrder.order.id,
    type: 'SALES',
    subtotal: Math.round(quoteKavita.total / 1.138),
    taxRate: 13.8,
    status: 'PAID',
    createdAt: kavitaCompletedAt,
    paidAt: kavitaCompletedAt,
  });

  // Ramesh: old installation whose inverter warranty has expired.
  const rameshCompletedAt = daysAgo(1090);
  const rameshOrder = await createOrder(quoteRamesh, {
    status: 'COMPLETED',
    createdAt: daysAgo(1110),
    approvedAt: rameshCompletedAt,
    dispatchAt: daysAgo(1100),
    installedAt: rameshCompletedAt,
    completedAt: rameshCompletedAt,
    paid: quoteRamesh.total,
    allocate: 'installed',
    warrantyStart: rameshCompletedAt,
    job: {
      technicianId: tech2.id,
      scheduledDate: daysAgo(1091),
      status: 'COMPLETED',
      hours: 5,
      completedAt: rameshCompletedAt,
      notes: 'Legacy 3 kW on-grid installation.',
    },
  });
  await createInvoice({
    customerId: ramesh.id,
    orderId: rameshOrder.order.id,
    type: 'SALES',
    subtotal: Math.round(quoteRamesh.total / 1.138),
    taxRate: 13.8,
    status: 'PAID',
    createdAt: rameshCompletedAt,
    paidAt: rameshCompletedAt,
  });

  // Rohit: completed last month, adds a second September job to the analytics.
  const rohitCompletedAt = daysAgo(40);
  const rohitOrder = await createOrder(quoteRohit, {
    status: 'COMPLETED',
    createdAt: daysAgo(55),
    approvedAt: rohitCompletedAt,
    dispatchAt: daysAgo(46),
    installedAt: rohitCompletedAt,
    completedAt: rohitCompletedAt,
    paid: quoteRohit.total,
    allocate: 'installed',
    warrantyStart: rohitCompletedAt,
    job: {
      technicianId: tech2.id,
      scheduledDate: daysAgo(41),
      status: 'COMPLETED',
      hours: 9,
      completedAt: rohitCompletedAt,
      notes: '5 kW on-grid factory installation. Net meter synchronised.',
    },
  });
  await createInvoice({
    customerId: rohit.id,
    orderId: rohitOrder.order.id,
    type: 'SALES',
    subtotal: Math.round(quoteRohit.total / 1.138),
    taxRate: 13.8,
    status: 'PAID',
    createdAt: rohitCompletedAt,
    paidAt: rohitCompletedAt,
  });

  console.log('Creating subsidy records…');
  const subsidyPlan: Array<{
    customerId: string;
    orderId: string;
    status: SubsidyStatus;
    amount: number;
    submittedAt?: Date;
    approvedAt?: Date;
  }> = [
    { customerId: david.id, orderId: davidOrder.order.id, status: 'NOT_STARTED', amount: 0 },
    { customerId: pooja.id, orderId: poojaOrder.order.id, status: 'DOCUMENTS_PENDING', amount: 78000 },
    {
      customerId: lakshmi.id,
      orderId: lakshmiOrder.order.id,
      status: 'SUBMITTED',
      amount: 39000,
      submittedAt: daysAgo(2),
    },
    {
      customerId: arjun.id,
      orderId: arjunOrder.order.id,
      status: 'APPROVED',
      amount: 78000,
      submittedAt: daysAgo(30),
      approvedAt: daysAgo(5),
    },
    {
      customerId: naveen.id,
      orderId: naveenOrder.order.id,
      status: 'DISBURSED',
      amount: 78000,
      submittedAt: daysAgo(60),
      approvedAt: daysAgo(45),
    },
    {
      customerId: kavita.id,
      orderId: kavitaOrder.order.id,
      status: 'DISBURSED',
      amount: 39000,
      submittedAt: daysAgo(85),
      approvedAt: daysAgo(70),
    },
    { customerId: ramesh.id, orderId: rameshOrder.order.id, status: 'NOT_STARTED', amount: 0 },
    {
      customerId: rohit.id,
      orderId: rohitOrder.order.id,
      status: 'DISBURSED',
      amount: 78000,
      submittedAt: daysAgo(45),
      approvedAt: daysAgo(30),
    },
  ];

  for (const subsidy of subsidyPlan) {
    await prisma.subsidyRecord.create({
      data: {
        ...subsidy,
        scheme: 'PM Surya Ghar',
        applicationNumber:
          subsidy.status === 'NOT_STARTED' ? undefined : `PM-SG-${year}-${pad(subsidy.amount)}`,
      },
    });
  }

  console.log('Creating warranty tickets…');
  const arjunInverter = arjunOrder.units.find(
    (unit) => productMap.get(unit.productId)?.category === 'INVERTER',
  );
  const lakshmiInverter = lakshmiOrder.units.find(
    (unit) => productMap.get(unit.productId)?.category === 'INVERTER',
  );
  const rameshInverter = rameshOrder.units.find(
    (unit) => productMap.get(unit.productId)?.category === 'INVERTER',
  );
  const kavitaBattery = kavitaOrder.units.find(
    (unit) => productMap.get(unit.productId)?.category === 'BATTERY',
  );

  ticketSeq += 1;
  const ticketArjun = await prisma.ticket.create({
    data: {
      ticketNumber: `SP-T-${year}-${pad(ticketSeq)}`,
      customerId: arjun.id,
      orderId: arjunOrder.order.id,
      productId: arjunInverter?.productId,
      serialNumber: arjunInverter?.serialNumber,
      issue: 'Inverter shows fault code E-07 and there is zero power output.',
      faultCode: 'E-07',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      warrantyStatus: 'IN_WARRANTY',
      warrantyEnd: arjunInverter?.warrantyEnd,
      billable: false,
      assignedToId: support.id,
      createdAt: daysAgo(1),
      updates: {
        create: [
          {
            authorId: support.id,
            message:
              'Customer called about an inverter fault. Serial found in warranty; repair approved at zero cost.',
            statusTo: 'OPEN',
            createdAt: daysAgo(1),
          },
          {
            authorId: support.id,
            message: 'Technician Vikram assigned for a site visit this afternoon.',
            statusFrom: 'OPEN',
            statusTo: 'IN_PROGRESS',
            createdAt: daysAgo(1),
          },
        ],
      },
    },
  });

  jobSeq += 1;
  await prisma.job.create({
    data: {
      jobNumber: `SP-J-${year}-${pad(jobSeq)}`,
      customerId: arjun.id,
      type: 'REPAIR',
      status: 'IN_PROGRESS',
      technicianId: tech2.id,
      scheduledDate: new Date(now.getFullYear(), now.getMonth(), now.getDate(), 14, 0),
      scheduledSlot: '14:00 - 16:00',
      notes: `Warranty repair for ${ticketArjun.ticketNumber}. Inverter E-07.`,
    },
  });

  ticketSeq += 1;
  const ticketRamesh = await prisma.ticket.create({
    data: {
      ticketNumber: `SP-T-${year}-${pad(ticketSeq)}`,
      customerId: ramesh.id,
      orderId: rameshOrder.order.id,
      productId: rameshInverter?.productId,
      serialNumber: rameshInverter?.serialNumber,
      issue: 'Inverter shuts down every afternoon and the display is blank.',
      faultCode: 'E-03',
      priority: 'MEDIUM',
      status: 'RESOLVED',
      warrantyStatus: 'OUT_OF_WARRANTY',
      warrantyEnd: rameshInverter?.warrantyEnd,
      billable: true,
      laborCharge: 1500,
      partsCharge: 12000,
      totalCharge: 13500,
      assignedToId: support.id,
      resolution: 'Replaced the inverter control board. System tested for two hours.',
      createdAt: daysAgo(6),
      resolvedAt: daysAgo(4),
      updates: {
        create: [
          {
            authorId: support.id,
            message: 'Serial number warranty expired. Shared estimate with customer before repair.',
            statusTo: 'OPEN',
            createdAt: daysAgo(6),
          },
          {
            authorId: support.id,
            message: 'Control board replaced and system tested. Repair invoice raised.',
            statusFrom: 'IN_PROGRESS',
            statusTo: 'RESOLVED',
            createdAt: daysAgo(4),
          },
        ],
      },
    },
  });

  await createInvoice({
    customerId: ramesh.id,
    ticketId: ticketRamesh.id,
    type: 'REPAIR',
    subtotal: 13500,
    taxRate: 18,
    status: 'SENT',
    createdAt: daysAgo(4),
  });

  ticketSeq += 1;
  await prisma.ticket.create({
    data: {
      ticketNumber: `SP-T-${year}-${pad(ticketSeq)}`,
      customerId: lakshmi.id,
      orderId: lakshmiOrder.order.id,
      productId: lakshmiInverter?.productId,
      serialNumber: lakshmiInverter?.serialNumber,
      issue: 'Monitoring dongle stays offline even though the inverter is generating.',
      faultCode: 'Wi-Fi',
      priority: 'LOW',
      status: 'OPEN',
      warrantyStatus: 'IN_WARRANTY',
      warrantyEnd: lakshmiInverter?.warrantyEnd,
      billable: false,
      assignedToId: support.id,
      createdAt: daysAgo(0),
      updates: {
        create: {
          authorId: support.id,
          message: 'Customer raised a monitoring issue. Unit is under warranty; remote check scheduled.',
          statusTo: 'OPEN',
        },
      },
    },
  });

  if (kavitaBattery) {
    ticketSeq += 1;
    await prisma.ticket.create({
      data: {
        ticketNumber: `SP-T-${year}-${pad(ticketSeq)}`,
        customerId: kavita.id,
        orderId: kavitaOrder.order.id,
        productId: kavitaBattery.productId,
        serialNumber: kavitaBattery.serialNumber,
        issue: 'Battery backup duration dropped below two hours.',
        faultCode: 'BMS-02',
        priority: 'MEDIUM',
        status: 'CLOSED',
        warrantyStatus: 'IN_WARRANTY',
        warrantyEnd: kavitaBattery.warrantyEnd,
        billable: false,
        assignedToId: support.id,
        resolution: 'BMS firmware updated and battery cells balanced. Customer confirmed.',
        createdAt: daysAgo(20),
        resolvedAt: daysAgo(18),
        closedAt: daysAgo(17),
        customerConfirmedAt: daysAgo(17),
        updates: {
          create: [
            {
              authorId: support.id,
              message: 'Battery diagnostics completed under warranty.',
              statusFrom: 'OPEN',
              statusTo: 'RESOLVED',
              createdAt: daysAgo(18),
            },
            {
              authorId: support.id,
              message: 'Customer confirmed backup is back to normal. Ticket closed.',
              statusFrom: 'RESOLVED',
              statusTo: 'CLOSED',
              createdAt: daysAgo(17),
            },
          ],
        },
      },
    });
  }

  console.log('Creating expenses…');
  const expenses: Array<{
    category: string;
    description: string;
    amount: number;
    date: Date;
    jobId?: string;
  }> = [
    { category: 'Office rent', description: 'Office and warehouse rent', amount: 45000, date: daysAgo(3) },
    { category: 'Salaries', description: 'Crew and office salaries', amount: 185000, date: daysAgo(2) },
    { category: 'Fuel', description: 'Installation van fuel', amount: 12500, date: daysAgo(5) },
    { category: 'Tools', description: 'Replacement drill bits and consumables', amount: 8500, date: daysAgo(7) },
    { category: 'Utilities', description: 'Internet and electricity', amount: 2500, date: daysAgo(8) },
    { category: 'Site expense', description: 'Crane and scaffolding', amount: 1200, date: arjunCompletedAt, jobId: arjunOrder.job?.id },
    { category: 'Site expense', description: 'Cable trays and conduit', amount: 1500, date: naveenCompletedAt, jobId: naveenOrder.job?.id },
    { category: 'Site expense', description: 'Transport and loading', amount: 800, date: kavitaCompletedAt, jobId: kavitaOrder.job?.id },
    { category: 'Site expense', description: 'Legacy site transport', amount: 500, date: rameshCompletedAt, jobId: rameshOrder.job?.id },
    { category: 'Site expense', description: 'Factory roof scaffolding', amount: 2200, date: rohitCompletedAt, jobId: rohitOrder.job?.id },
    { category: 'Office rent', description: 'Office and warehouse rent', amount: 45000, date: monthsAgo(1) },
    { category: 'Salaries', description: 'Crew and office salaries', amount: 180000, date: monthsAgo(1) },
    { category: 'Fuel', description: 'Installation van fuel', amount: 10500, date: monthsAgo(1) },
    { category: 'Office rent', description: 'Office and warehouse rent', amount: 45000, date: monthsAgo(2) },
    { category: 'Salaries', description: 'Crew and office salaries', amount: 175000, date: monthsAgo(2) },
    { category: 'Fuel', description: 'Installation van fuel', amount: 9800, date: monthsAgo(2) },
    { category: 'Office rent', description: 'Office and warehouse rent', amount: 45000, date: monthsAgo(3) },
    { category: 'Salaries', description: 'Crew and office salaries', amount: 170000, date: monthsAgo(3) },
  ];

  for (const expense of expenses) {
    await prisma.expense.create({
      data: { ...expense, createdById: director.id },
    });
  }

  console.log('');
  console.log('✅ Demo data ready');
  console.log('   Staff logins (password: SunPower@123)');
  console.log('   director@sunpower.in   Director');
  console.log('   sales@sunpower.in      Sales & Office');
  console.log('   tech@sunpower.in       Technician (Arun)');
  console.log('   tech2@sunpower.in      Technician (Vikram)');
  console.log('   warehouse@sunpower.in  Warehouse');
  console.log('   support@sunpower.in    Support');
  console.log('');
  console.log('   Public quote demos: /q/demo-david, /q/demo-pooja, /q/demo-lakshmi');
  console.log('   Key serials:');
  console.log(`   Arjun inverter (in warranty): ${arjunInverter?.serialNumber ?? 'n/a'}`);
  console.log(`   Ramesh inverter (expired):    ${rameshInverter?.serialNumber ?? 'n/a'}`);
  console.log(`   Lakshmi inverter (in warranty): ${lakshmiInverter?.serialNumber ?? 'n/a'}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
