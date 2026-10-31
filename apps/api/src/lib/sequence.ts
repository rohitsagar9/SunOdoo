import { prisma } from './prisma.js';

const pad = (value: number, size = 4) => String(value).padStart(size, '0');

async function next(prefix: string, findLatest: () => Promise<string | null>) {
  const year = new Date().getFullYear();
  const latest = await findLatest();
  let maxSeq = 0;
  if (latest) {
    const parts = latest.split('-');
    const num = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(num)) maxSeq = num;
  }
  return `${prefix}-${year}-${pad(maxSeq + 1)}`;
}

export function nextQuoteNumber() {
  const year = new Date().getFullYear();
  return next('SP-Q', async () => (await prisma.quote.findFirst({
    where: { quoteNumber: { startsWith: `SP-Q-${year}-` } },
    orderBy: { quoteNumber: 'desc' },
    select: { quoteNumber: true },
  }))?.quoteNumber ?? null);
}

export function nextOrderNumber() {
  const year = new Date().getFullYear();
  return next('SP-O', async () => (await prisma.order.findFirst({
    where: { orderNumber: { startsWith: `SP-O-${year}-` } },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  }))?.orderNumber ?? null);
}

export function nextJobNumber() {
  const year = new Date().getFullYear();
  return next('SP-J', async () => (await prisma.job.findFirst({
    where: { jobNumber: { startsWith: `SP-J-${year}-` } },
    orderBy: { jobNumber: 'desc' },
    select: { jobNumber: true },
  }))?.jobNumber ?? null);
}

export function nextTicketNumber() {
  const year = new Date().getFullYear();
  return next('SP-T', async () => (await prisma.ticket.findFirst({
    where: { ticketNumber: { startsWith: `SP-T-${year}-` } },
    orderBy: { ticketNumber: 'desc' },
    select: { ticketNumber: true },
  }))?.ticketNumber ?? null);
}

export function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  return next('SP-INV', async () => (await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: `SP-INV-${year}-` } },
    orderBy: { invoiceNumber: 'desc' },
    select: { invoiceNumber: true },
  }))?.invoiceNumber ?? null);
}

export function nextLeadReference() {
  const year = new Date().getFullYear();
  return next('SP-L', async () => (await prisma.lead.findFirst({
    where: { reference: { startsWith: `SP-L-${year}-` } },
    orderBy: { reference: 'desc' },
    select: { reference: true },
  }))?.reference ?? null);
}

export function publicToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
