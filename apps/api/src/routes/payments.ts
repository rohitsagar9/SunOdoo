import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { nextJobNumber } from '../lib/sequence.js';
import { audit } from '../lib/audit.js';

const paymentInclude = {
  order: {
    include: {
      customer: true,
      quote: true,
      job: true,
    },
  },
  ticket: { include: { customer: true, product: true } },
  submittedBy: { select: { id: true, name: true } },
  approvedBy: { select: { id: true, name: true } },
};

async function recalcOrder(orderId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payments: true, job: true, customer: true },
  });
  if (!order) throw notFound('Order');

  const approved = order.payments
    .filter((payment) => payment.status === 'APPROVED')
    .reduce((sum, payment) => sum + payment.amount, 0);
  const advancePaid = Math.min(approved, order.total);
  const balanceDue = Math.max(order.total - advancePaid, 0);

  let status = order.status;
  if (order.status === 'PENDING_PAYMENT' && advancePaid > 0) {
    status = 'ADVANCE_PAID';
  } else if (order.status === 'INSTALLED' && balanceDue === 0) {
    status = 'COMPLETED';
  }

  return { order, advancePaid, balanceDue, status };
}

async function ensureInstallationJob(orderId: string, userId: string) {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { job: true, customer: true },
  });
  if (!order) throw notFound('Order');
  if (order.job) return order.job;

  const technician = await prisma.user.findFirst({
    where: { role: 'TECHNICIAN', active: true },
    orderBy: { createdAt: 'asc' },
  });

  const job = await prisma.job.create({
    data: {
      jobNumber: await nextJobNumber(),
      orderId: order.id,
      leadId: order.leadId,
      customerId: order.customerId,
      type: 'INSTALLATION',
      status: 'SCHEDULED',
      technicianId: technician?.id,
      scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      scheduledSlot: '09:00 - 13:00',
      notes: `Installation for ${order.customer.name}. Auto-created after advance payment approval.`,
    },
  });

  await audit(userId, 'INSTALLATION_JOB_CREATED', 'Job', job.id, { orderId });
  return job;
}

export const paymentRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/payments',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR', 'SUPPORT', 'WAREHOUSE')] },
    async (request) => {
      const query = z
        .object({
          status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
          orderId: z.string().optional(),
        })
        .parse(request.query);

      return prisma.payment.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.orderId ? { orderId: query.orderId } : {}),
        },
        include: paymentInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      });
    },
  );

  app.post(
    '/payments',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR', 'TECHNICIAN')] },
    async (request, reply) => {
      const body = z
        .object({
          orderId: z.string().optional(),
          ticketId: z.string().optional(),
          amount: z.coerce.number().int().positive(),
          method: z.enum(['UPI', 'CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE']).default('CASH'),
          type: z.enum(['ADVANCE', 'BALANCE', 'FULL']).default('ADVANCE'),
          reference: z.string().max(120).optional(),
          notes: z.string().max(500).optional(),
          autoApprove: z.boolean().optional(),
        })
        .parse(request.body);

      if (!body.orderId && !body.ticketId) {
        throw new AppError(422, 'A payment must belong to an order or a repair ticket', 'MISSING_TARGET');
      }

      const payment = await prisma.payment.create({
        data: {
          orderId: body.orderId,
          ticketId: body.ticketId,
          amount: body.amount,
          method: body.method,
          type: body.type,
          reference: body.reference,
          notes: body.notes,
          submittedById: request.user.sub,
          status: body.autoApprove && ['DIRECTOR', 'SALES'].includes(request.user.role) ? 'APPROVED' : 'PENDING',
          approvedById: body.autoApprove ? request.user.sub : undefined,
          approvedAt: body.autoApprove ? new Date() : undefined,
        },
        include: paymentInclude,
      });

      if (payment.status === 'APPROVED' && body.orderId) {
        const calc = await recalcOrder(body.orderId);
        await prisma.order.update({
          where: { id: body.orderId },
          data: {
            advancePaid: calc.advancePaid,
            balanceDue: calc.balanceDue,
            status: calc.status,
            completedAt: calc.status === 'COMPLETED' ? (calc.order.completedAt ?? new Date()) : undefined,
            approvedById: request.user.sub,
            approvedAt: new Date(),
          },
        });
        await ensureInstallationJob(body.orderId, request.user.sub);

        if (calc.balanceDue === 0) {
          const invoice = await prisma.invoice.findFirst({ where: { orderId: body.orderId } });
          if (invoice && invoice.status !== 'PAID') {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: 'PAID', paidAt: new Date() },
            });
          }
        }
      }

      if (payment.status === 'APPROVED' && body.ticketId) {
        const invoice = await prisma.invoice.findFirst({ where: { ticketId: body.ticketId } });
        if (invoice && invoice.status !== 'PAID') {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: 'PAID', paidAt: new Date() },
          });
        }
      }

      await audit(request.user.sub, 'PAYMENT_RECORDED', 'Payment', payment.id, {
        amount: payment.amount,
        method: payment.method,
      });
      return reply.code(201).send(payment);
    },
  );

  app.post(
    '/payments/:id/approve',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const existing = await prisma.payment.findUnique({
        where: { id },
        include: { order: true, ticket: true },
      });
      if (!existing) throw notFound('Payment');
      if (existing.status === 'APPROVED') {
        return prisma.payment.findUnique({ where: { id }, include: paymentInclude });
      }

      const payment = await prisma.payment.update({
        where: { id },
        data: { status: 'APPROVED', approvedById: request.user.sub, approvedAt: new Date() },
        include: paymentInclude,
      });

      if (existing.orderId) {
        const calc = await recalcOrder(existing.orderId);
        await prisma.order.update({
          where: { id: existing.orderId },
          data: {
            advancePaid: calc.advancePaid,
            balanceDue: calc.balanceDue,
            status: calc.status,
            completedAt: calc.status === 'COMPLETED' ? (calc.order.completedAt ?? new Date()) : undefined,
            approvedById: request.user.sub,
            approvedAt: new Date(),
          },
        });
        await ensureInstallationJob(existing.orderId, request.user.sub);

        if (calc.balanceDue === 0) {
          const invoice = await prisma.invoice.findFirst({ where: { orderId: existing.orderId } });
          if (invoice && invoice.status !== 'PAID') {
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: 'PAID', paidAt: new Date() },
            });
          }
        }
      }

      if (existing.ticketId) {
        const invoice = await prisma.invoice.findFirst({ where: { ticketId: existing.ticketId } });
        if (invoice) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: { status: 'PAID', paidAt: new Date() },
          });
        }
      }

      await audit(request.user.sub, 'PAYMENT_APPROVED', 'Payment', id, {
        amount: existing.amount,
        orderId: existing.orderId,
        ticketId: existing.ticketId,
      });

      return payment;
    },
  );

  app.post(
    '/payments/:id/reject',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({ reason: z.string().max(500).optional() }).parse(request.body ?? {});
      const existing = await prisma.payment.findUnique({ where: { id } });
      if (!existing) throw notFound('Payment');

      const payment = await prisma.payment.update({
        where: { id },
        data: {
          status: 'REJECTED',
          notes: body.reason ? `${existing.notes ?? ''}\nRejected: ${body.reason}`.trim() : existing.notes,
          approvedById: request.user.sub,
          approvedAt: new Date(),
        },
        include: paymentInclude,
      });

      await audit(request.user.sub, 'PAYMENT_REJECTED', 'Payment', id, { reason: body.reason });
      return payment;
    },
  );
};
