import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { notFound } from '../lib/errors.js';
import { audit } from '../lib/audit.js';

export const expenseRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/expenses',
    { preHandler: [app.authenticate, app.authorize('DIRECTOR', 'SALES')] },
    async (request) => {
      const query = z
        .object({ from: z.string().optional(), to: z.string().optional() })
        .parse(request.query);

      return prisma.expense.findMany({
        where: {
          ...(query.from || query.to
            ? {
                date: {
                  ...(query.from ? { gte: new Date(query.from) } : {}),
                  ...(query.to ? { lte: new Date(`${query.to}T23:59:59`) } : {}),
                },
              }
            : {}),
        },
        include: { job: { include: { customer: true } }, createdBy: { select: { name: true } } },
        orderBy: { date: 'desc' },
      });
    },
  );

  app.post(
    '/expenses',
    { preHandler: [app.authenticate, app.authorize('DIRECTOR')] },
    async (request, reply) => {
      const body = z
        .object({
          category: z.string().min(2).max(60),
          description: z.string().min(2).max(300),
          amount: z.coerce.number().int().positive(),
          jobId: z.string().optional(),
          date: z.coerce.date().optional(),
        })
        .parse(request.body);

      const expense = await prisma.expense.create({
        data: { ...body, createdById: request.user.sub },
        include: { job: { include: { customer: true } } },
      });
      await audit(request.user.sub, 'EXPENSE_CREATED', 'Expense', expense.id, {
        amount: expense.amount,
      });
      return reply.code(201).send(expense);
    },
  );

  app.get(
    '/subsidies',
    { preHandler: [app.authenticate, app.authorize('DIRECTOR', 'SALES')] },
    async () => {
      return prisma.subsidyRecord.findMany({
        include: {
          customer: true,
          order: { include: { quote: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
    },
  );

  app.patch(
    '/subsidies/:id',
    { preHandler: [app.authenticate, app.authorize('DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          status: z.enum([
            'NOT_STARTED',
            'DOCUMENTS_PENDING',
            'SUBMITTED',
            'APPROVED',
            'REJECTED',
            'DISBURSED',
          ]),
          amount: z.coerce.number().int().min(0).optional(),
          applicationNumber: z.string().max(80).optional(),
          notes: z.string().max(1000).optional(),
        })
        .parse(request.body);

      const existing = await prisma.subsidyRecord.findUnique({ where: { id } });
      if (!existing) throw notFound('Subsidy record');

      const updated = await prisma.subsidyRecord.update({
        where: { id },
        data: {
          ...body,
          submittedAt:
            body.status === 'SUBMITTED' && !existing.submittedAt ? new Date() : existing.submittedAt,
          approvedAt:
            ['APPROVED', 'DISBURSED'].includes(body.status) && !existing.approvedAt
              ? new Date()
              : existing.approvedAt,
        },
      });
      await audit(request.user.sub, 'SUBSIDY_UPDATED', 'SubsidyRecord', id, { status: body.status });
      return updated;
    },
  );
};
