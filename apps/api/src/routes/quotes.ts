import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { createQuoteForLead, acceptQuote } from '../services/quotes.js';
import { priceBom } from '../services/bom.js';
import { audit } from '../lib/audit.js';

const quoteInclude = {
  items: { orderBy: { sortOrder: 'asc' as const } },
  customer: true,
  lead: { include: { customer: true, survey: true } },
  createdBy: { select: { id: true, name: true } },
  order: { include: { payments: true, job: true } },
};

export const quoteRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/quotes',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const query = z
        .object({
          status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']).optional(),
          search: z.string().optional(),
        })
        .parse(request.query);

      return prisma.quote.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.search
            ? {
                OR: [
                  { quoteNumber: { contains: query.search, mode: 'insensitive' } },
                  { customer: { name: { contains: query.search, mode: 'insensitive' } } },
                  { customer: { phone: { contains: query.search } } },
                ],
              }
            : {}),
        },
        include: quoteInclude,
        orderBy: { createdAt: 'desc' },
      });
    },
  );

  app.get(
    '/quotes/:id',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const quote = await prisma.quote.findUnique({ where: { id }, include: quoteInclude });
      if (!quote) throw notFound('Quote');
      return quote;
    },
  );

  app.post(
    '/quotes',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request, reply) => {
      const body = z
        .object({
          leadId: z.string().min(1),
          capacityKw: z.coerce.number().int().min(1).max(5).optional(),
          systemType: z.enum(['ON_GRID', 'OFF_GRID']).optional(),
          discount: z.coerce.number().int().min(0).optional(),
          notes: z.string().max(2000).optional(),
        })
        .parse(request.body);

      const quote = await createQuoteForLead({
        leadId: body.leadId,
        createdById: request.user.sub,
        capacityKw: body.capacityKw,
        systemType: body.systemType,
        discount: body.discount,
        notes: body.notes,
      });

      return reply.code(201).send(quote);
    },
  );

  app.post(
    '/quotes/:id/recalculate',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          capacityKw: z.coerce.number().int().min(1).max(5).optional(),
          systemType: z.enum(['ON_GRID', 'OFF_GRID']).optional(),
          discount: z.coerce.number().int().min(0).optional(),
        })
        .parse(request.body);

      const quote = await prisma.quote.findUnique({ where: { id }, include: { order: true } });
      if (!quote) throw notFound('Quote');
      if (quote.order) throw new AppError(409, 'An accepted quote cannot be edited', 'QUOTE_LOCKED');

      const capacityKw = body.capacityKw ?? quote.capacityKw;
      const systemType = body.systemType ?? quote.systemType;
      const priced = await priceBom(capacityKw, systemType, body.discount ?? quote.discount);

      const updated = await prisma.quote.update({
        where: { id },
        data: {
          capacityKw,
          systemType,
          subtotal: priced.subtotal,
          discount: priced.discount,
          taxRate: priced.taxRate,
          taxAmount: priced.taxAmount,
          total: priced.total,
          advanceAmount: priced.advanceAmount,
          items: {
            deleteMany: {},
            create: priced.items,
          },
        },
        include: quoteInclude,
      });

      await audit(request.user.sub, 'QUOTE_RECALCULATED', 'Quote', id, { capacityKw, systemType });
      return updated;
    },
  );

  app.patch(
    '/quotes/:id/status',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED']),
          notes: z.string().optional(),
        })
        .parse(request.body);

      const quote = await prisma.quote.findUnique({ where: { id }, include: { order: true } });
      if (!quote) throw notFound('Quote');

      if (body.status === 'ACCEPTED' && !quote.order) {
        return acceptQuote(quote.publicToken);
      }

      const updated = await prisma.quote.update({
        where: { id },
        data: { status: body.status, notes: body.notes ?? quote.notes },
        include: quoteInclude,
      });

      await audit(request.user.sub, 'QUOTE_STATUS_CHANGED', 'Quote', id, { status: body.status });
      return updated;
    },
  );
};
