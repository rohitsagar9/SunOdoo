import { prisma } from './prisma.js';

const pad = (value: number, size = 4) => String(value).padStart(size, '0');

async function next(prefix: string, count: () => Promise<number>) {
  const year = new Date().getFullYear();
  const total = await count();
  return `${prefix}-${year}-${pad(total + 1)}`;
}

export function nextQuoteNumber() {
  const year = new Date().getFullYear();
  return next('SP-Q', () => prisma.quote.count({ where: { quoteNumber: { startsWith: `SP-Q-${year}-` } } }));
}

export function nextOrderNumber() {
  const year = new Date().getFullYear();
  return next('SP-O', () => prisma.order.count({ where: { orderNumber: { startsWith: `SP-O-${year}-` } } }));
}

export function nextJobNumber() {
  const year = new Date().getFullYear();
  return next('SP-J', () => prisma.job.count({ where: { jobNumber: { startsWith: `SP-J-${year}-` } } }));
}

export function nextTicketNumber() {
  const year = new Date().getFullYear();
  return next('SP-T', () => prisma.ticket.count({ where: { ticketNumber: { startsWith: `SP-T-${year}-` } } }));
}

export function nextInvoiceNumber() {
  const year = new Date().getFullYear();
  return next('SP-INV', () => prisma.invoice.count({ where: { invoiceNumber: { startsWith: `SP-INV-${year}-` } } }));
}

export function nextLeadReference() {
  const year = new Date().getFullYear();
  return next('SP-L', () => prisma.lead.count({ where: { reference: { startsWith: `SP-L-${year}-` } } }));
}

export function publicToken() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}
