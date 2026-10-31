import type { SystemType } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { nextQuoteNumber, publicToken } from '../lib/sequence.js';
import { priceBom } from './bom.js';
import { audit } from '../lib/audit.js';

interface CreateQuoteInput {
  leadId: string;
  createdById: string;
  capacityKw?: number;
  systemType?: SystemType;
  discount?: number;
  notes?: string;
}

export async function createQuoteForLead(input: CreateQuoteInput) {
  const lead = await prisma.lead.findUnique({
    where: { id: input.leadId },
    include: { customer: true, survey: true },
  });

  if (!lead) throw notFound('Lead');
  if (!lead.survey?.approved) {
    throw new AppError(409, 'Approve the roof survey before generating a quote', 'SURVEY_NOT_APPROVED');
  }

  const capacityKw = input.capacityKw ?? lead.requestedKw;
  const systemType = input.systemType ?? lead.systemType;
  const priced = await priceBom(capacityKw, systemType, input.discount ?? 0);
  const quoteNumber = await nextQuoteNumber();
  const validUntil = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const quote = await prisma.$transaction(async (tx) => {
    const created = await tx.quote.create({
      data: {
        quoteNumber,
        leadId: lead.id,
        customerId: lead.customerId,
        systemType,
        capacityKw,
        subtotal: priced.subtotal,
        discount: priced.discount,
        taxRate: priced.taxRate,
        taxAmount: priced.taxAmount,
        total: priced.total,
        advanceAmount: priced.advanceAmount,
        validUntil,
        publicToken: publicToken(),
        notes: input.notes,
        status: 'SENT',
        createdById: input.createdById,
        items: {
          create: priced.items,
        },
      },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        customer: true,
        lead: true,
      },
    });

    await tx.lead.update({ where: { id: lead.id }, data: { status: 'QUOTED' } });
    return created;
  });

  await audit(input.createdById, 'QUOTE_CREATED', 'Quote', quote.id, {
    quoteNumber: quote.quoteNumber,
    total: quote.total,
  });

  return quote;
}

export async function acceptQuote(token: string) {
  const quote = await prisma.quote.findUnique({
    where: { publicToken: token },
    include: {
      customer: true,
      lead: true,
      items: true,
      order: { include: { payments: true, job: true } },
    },
  });

  if (!quote) throw notFound('Quote');
  if (quote.status === 'REJECTED' || quote.status === 'EXPIRED') {
    throw new AppError(409, 'This quote is no longer available', 'QUOTE_CLOSED');
  }
  if (quote.order) return { quote, order: quote.order, created: false };

  const orderNumber = `SP-O-${new Date().getFullYear()}-${String(
    (await prisma.order.count()) + 1,
  ).padStart(4, '0')}`;

  const order = await prisma.$transaction(async (tx) => {
    await tx.quote.update({ where: { id: quote.id }, data: { status: 'ACCEPTED' } });
    if (quote.leadId) {
      await tx.lead.update({ where: { id: quote.leadId }, data: { status: 'WON' } });
    }

    const created = await tx.order.create({
      data: {
        orderNumber,
        quoteId: quote.id,
        leadId: quote.leadId,
        customerId: quote.customerId,
        total: quote.total,
        balanceDue: quote.total,
        status: 'PENDING_PAYMENT',
      },
      include: { payments: true, job: true, quote: true },
    });

    const hardware = quote.items.filter(
      (item) => item.productId && !['SERVICE', 'TOOL'].includes(item.category),
    );
    if (hardware.length > 0) {
      await tx.kitItem.createMany({
        data: hardware.map((item) => ({
          orderId: created.id,
          productId: item.productId!,
          quantity: item.quantity,
        })),
      });
    }

    await tx.subsidyRecord.create({
      data: {
        customerId: quote.customerId,
        orderId: created.id,
        scheme: 'PM Surya Ghar',
        status: 'NOT_STARTED',
      },
    });

    return created;
  });

  await audit(null, 'QUOTE_ACCEPTED', 'Quote', quote.id, { orderId: order.id });
  return { quote, order, created: true };
}
