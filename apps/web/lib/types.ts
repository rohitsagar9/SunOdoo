export type Role = 'DIRECTOR' | 'SALES' | 'TECHNICIAN' | 'WAREHOUSE' | 'SUPPORT';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  phone?: string | null;
}

export interface Customer {
  id: string;
  name: string;
  phone: string;
  email?: string | null;
  address: string;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  monthlyBill?: number | null;
  roofAreaSqft?: number | null;
  notes?: string | null;
  createdAt: string;
}

export interface Survey {
  id: string;
  leadId: string;
  technicianId?: string | null;
  scheduledAt?: string | null;
  completedAt?: string | null;
  roofDirection?: string | null;
  tiltDegrees?: number | null;
  cableDistanceM?: number | null;
  shadowFreeAreaSqft?: number | null;
  approved: boolean;
  findings?: string | null;
  technician?: { id: string; name: string } | null;
}

export interface Lead {
  id: string;
  reference: string;
  customerId: string;
  source: string;
  requestedKw: number;
  systemType: 'ON_GRID' | 'OFF_GRID';
  status: string;
  assignedToId?: string | null;
  monthlyBill?: number | null;
  roofAreaSqft?: number | null;
  notes?: string | null;
  lostReason?: string | null;
  createdAt: string;
  updatedAt: string;
  customer: Customer;
  assignedTo?: { id: string; name: string } | null;
  survey?: Survey | null;
  quotes?: Quote[];
  orders?: Order[];
  jobs?: Job[];
}

export interface QuoteItem {
  id: string;
  quoteId: string;
  productId?: string | null;
  description: string;
  category: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  total: number;
  sortOrder: number;
}

export interface Payment {
  id: string;
  orderId?: string | null;
  ticketId?: string | null;
  amount: number;
  method: string;
  type: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  screenshotUrl?: string | null;
  reference?: string | null;
  notes?: string | null;
  createdAt: string;
  approvedAt?: string | null;
  submittedBy?: { id: string; name: string } | null;
  approvedBy?: { id: string; name: string } | null;
  order?: Order;
  ticket?: Ticket;
}

export interface Quote {
  id: string;
  quoteNumber: string;
  leadId?: string | null;
  customerId: string;
  systemType: 'ON_GRID' | 'OFF_GRID';
  capacityKw: number;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: string;
  validUntil?: string | null;
  advanceAmount: number;
  publicToken: string;
  notes?: string | null;
  createdAt: string;
  items: QuoteItem[];
  customer: Customer;
  lead?: Lead | null;
  order?: Order | null;
  createdBy?: { id: string; name: string } | null;
}

export interface KitItem {
  id: string;
  orderId: string;
  productId: string;
  quantity: number;
  packed: boolean;
  packedAt?: string | null;
  product: Product;
}

export interface InventoryUnit {
  id: string;
  productId: string;
  serialNumber: string;
  status: string;
  warehouseLocation?: string | null;
  orderId?: string | null;
  warrantyStart?: string | null;
  warrantyEnd?: string | null;
  createdAt?: string;
  product: Product;
  order?: Order | null;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  unit: string;
  unitPrice: number;
  costPrice: number;
  warrantyMonths: number;
  capacityKw?: number | null;
  description?: string | null;
  barcodePath?: string | null;
  active: boolean;
}

export interface Job {
  id: string;
  jobNumber: string;
  orderId?: string | null;
  leadId?: string | null;
  customerId: string;
  type: 'SURVEY' | 'INSTALLATION' | 'REPAIR' | 'MAINTENANCE';
  status: string;
  technicianId?: string | null;
  scheduledDate: string;
  scheduledSlot?: string | null;
  clockInAt?: string | null;
  clockOutAt?: string | null;
  hoursWorked?: number | null;
  notes?: string | null;
  completionNotes?: string | null;
  completedAt?: string | null;
  customer: Customer;
  technician?: { id: string; name: string; phone?: string | null } | null;
  order?: Order | null;
  lead?: { id: string; reference?: string; survey?: Survey | null } | null;
  photos?: JobPhoto[];
  signature?: JobSignature | null;
  timeLogs?: TimeLog[];
}

export interface JobPhoto {
  id: string;
  jobId: string;
  url: string;
  caption?: string | null;
  createdAt: string;
}

export interface JobSignature {
  id: string;
  jobId: string;
  signerName: string;
  dataUrl: string;
  signedAt: string;
}

export interface TimeLog {
  id: string;
  jobId: string;
  userId: string;
  clockIn: string;
  clockOut?: string | null;
  minutes?: number | null;
  notes?: string | null;
}

export interface Order {
  id: string;
  orderNumber: string;
  quoteId: string;
  leadId?: string | null;
  customerId: string;
  status: string;
  total: number;
  advancePaid: number;
  balanceDue: number;
  approvedAt?: string | null;
  dispatchAt?: string | null;
  installedAt?: string | null;
  completedAt?: string | null;
  createdAt: string;
  customer: Customer;
  quote: Quote;
  lead?: Lead | null;
  payments?: Payment[];
  kitItems?: KitItem[];
  inventoryUnits?: InventoryUnit[];
  job?: Job | null;
  progress?: {
    totalItems: number;
    packedItems: number;
    requiredScans: number;
    scans: number;
    ready: boolean;
  };
}

export interface TicketUpdate {
  id: string;
  ticketId: string;
  message: string;
  statusFrom?: string | null;
  statusTo?: string | null;
  createdAt: string;
  author?: { id: string; name: string; role: string } | null;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  type: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  status: string;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt: string;
}

export interface Ticket {
  id: string;
  ticketNumber: string;
  customerId: string;
  orderId?: string | null;
  productId?: string | null;
  serialNumber?: string | null;
  issue: string;
  faultCode?: string | null;
  priority: string;
  status: string;
  warrantyStatus: string;
  warrantyEnd?: string | null;
  billable: boolean;
  laborCharge: number;
  partsCharge: number;
  totalCharge: number;
  assignedToId?: string | null;
  resolution?: string | null;
  createdAt: string;
  resolvedAt?: string | null;
  closedAt?: string | null;
  updatedAt?: string;
  customerConfirmedAt?: string | null;
  customer: Customer;
  product?: Product | null;
  assignedTo?: { id: string; name: string } | null;
  order?: Order | null;
  updates?: TicketUpdate[];
  invoices?: Invoice[];
  payments?: Payment[];
  _count?: { updates: number };
}

export interface DashboardSales {
  kpis: {
    newLeadsWeek: number;
    myLeads: number;
    pendingPayments: number;
    pendingPaymentValue: number;
    quotesSent: number;
    quotesAccepted: number;
    pipelineValue: number;
    surveysToday: number;
    conversionRate: number;
  };
  funnel: Array<{ status: string; count: number }>;
  pendingPayments: Payment[];
  recentLeads: Lead[];
  recentPayments: Payment[];
}

export interface DashboardTechnician {
  kpis: {
    jobsToday: number;
    completedMonth: number;
    hoursWeek: number;
    openTickets: number;
    upcoming: number;
  };
  todayJobs: Job[];
  upcoming: Job[];
  tickets: Ticket[];
}

export interface DashboardWarehouse {
  kpis: {
    readyToPack: number;
    readyToDispatch: number;
    dispatchedToday: number;
    lowStock: number;
    pendingOrders: number;
  };
  queue: Order[];
  lowStockProducts: Product[];
}

export interface DashboardSupport {
  kpis: {
    open: number;
    inProgress: number;
    resolved: number;
    active: number;
    warrantyExpiring: number;
  };
  warrantyCounts: Array<{ status: string; count: number }>;
  warrantyUnits: Array<
    InventoryUnit & { warrantyStatus: string; daysLeft: number | null }
  >;
  recentTickets: Ticket[];
}

export interface InventorySummaryRow {
  product: Product;
  inStock: number;
  reserved: number;
  dispatched: number;
  installed: number;
  faulty: number;
  lowStock: boolean;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  jobId?: string | null;
  createdById?: string | null;
  createdAt: string;
  job?: { id: string; jobNumber: string; customer?: Customer | null } | null;
  createdBy?: { name: string } | null;
}

export interface SubsidyRecord {
  id: string;
  orderId: string;
  customerId: string;
  amount: number;
  status: string;
  applicationNumber?: string | null;
  notes?: string | null;
  submittedAt?: string | null;
  approvedAt?: string | null;
  createdAt: string;
  customer: Customer;
  order?: Order | null;
}

export interface Catalog {
  products: Product[];
  categories: string[];
  upi: { id: string; name: string };
}

export interface SupportLookup {
  query: string;
  customers: Array<
    Customer & {
      orders: Array<{
        id: string;
        orderNumber: string;
        status: string;
        total: number;
        balanceDue: number;
        quote: { capacityKw: number; systemType: string };
      }>;
      tickets: Array<{
        id: string;
        ticketNumber: string;
        status: string;
        warrantyStatus: string;
        issue: string;
      }>;
    }
  >;
  units: Array<InventoryUnit & { warrantyStatus: string; warrantyDaysLeft: number | null }>;
  orders: Order[];
  tickets: Ticket[];
}

export interface PublicTrack {
  name: string;
  phone: string;
  address: string;
  orders: Array<{
    orderNumber: string;
    status: string;
    total: number;
    balanceDue: number;
    createdAt: string;
    quote: { capacityKw: number; systemType: string; publicToken: string };
    job?: { scheduledDate: string; status: string } | null;
  }>;
  tickets: Array<{
    ticketNumber: string;
    issue: string;
    status: string;
    warrantyStatus: string;
    createdAt: string;
  }>;
}

export interface DashboardDirector {
  generatedAt: string;
  kpis: {
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    expensesMonth: number;
    profitMonth: number;
    receivables: number;
    pendingInstallations: number;
    openTickets: number;
    urgentTickets: number;
    activeJobs: number;
    subsidyPending: number;
    technicianHoursMonth: number;
    overdueInvoices: number;
    conversionRate: number;
    totalLeads: number;
    wonLeads: number;
  };
  funnel: Array<{ status: string; count: number }>;
  monthly: Array<{ label: string; revenue: number; expenses: number; profit: number }>;
  jobProfitability: Array<{
    id: string;
    orderNumber: string;
    customer: string;
    capacityKw: number;
    systemType: string;
    revenue: number;
    partsCost: number;
    labourCost: number;
    otherCost: number;
    cost: number;
    profit: number;
    margin: number;
    status: string;
    completedAt?: string | null;
  }>;
  upcomingJobs: Job[];
  recentPayments: Payment[];
  paymentMix: Array<{ method: string; amount: number }>;
  pendingInstallOrders: Order[];
}
