import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { createTicket, updateTicket } from '../services/tickets.js';
import { warrantyStatus } from '../services/warranty.js';
import { nextInvoiceNumber, nextJobNumber } from '../lib/sequence.js';
import { audit } from '../lib/audit.js';

const ticketListInclude = {
  customer: true,
  product: true,
  assignedTo: { select: { id: true, name: true } },
  order: { select: { id: true, orderNumber: true, status: true } },
  _count: { select: { updates: true } },
} as const;

const ticketDetailInclude = {
  customer: true,
  product: true,
  assignedTo: { select: { id: true, name: true, role: true, phone: true } },
  order: { include: { quote: true, job: true } },
  updates: { include: { author: { select: { id: true, name: true, role: true } } }, orderBy: { createdAt: 'asc' as const } },
  invoices: true,
  payments: true,
  jobs: { include: { technician: true, signature: true, photos: true }, orderBy: { createdAt: 'desc' as const } },
} as const;

export const ticketRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/tickets',
    { preHandler: [app.authenticate, app.authorize('SUPPORT', 'DIRECTOR', 'SALES', 'TECHNICIAN')] },
    async (request) => {
      const query = z
        .object({
          status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
          warranty: z.enum(['IN_WARRANTY', 'OUT_OF_WARRANTY', 'UNKNOWN']).optional(),
          search: z.string().optional(),
        })
        .parse(request.query);

      return prisma.ticket.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.warranty ? { warrantyStatus: query.warranty } : {}),
          ...(query.search
            ? {
                OR: [
                  { ticketNumber: { contains: query.search, mode: 'insensitive' } },
                  { serialNumber: { contains: query.search, mode: 'insensitive' } },
                  { customer: { name: { contains: query.search, mode: 'insensitive' } } },
                  { customer: { phone: { contains: query.search } } },
                ],
              }
            : {}),
        },
        include: ticketListInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      });
    },
  );

  app.get(
    '/tickets/:id',
    { preHandler: [app.authenticate, app.authorize('SUPPORT', 'DIRECTOR', 'SALES', 'TECHNICIAN')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const ticket = await prisma.ticket.findUnique({ where: { id }, include: ticketDetailInclude });
      if (!ticket) throw notFound('Ticket');
      return ticket;
    },
  );

  app.post(
    '/tickets',
    { preHandler: [app.authenticate, app.authorize('SUPPORT', 'DIRECTOR', 'SALES')] },
    async (request, reply) => {
      const body = z
        .object({
          customerId: z.string().optional(),
          phone: z.string().optional(),
          serialNumber: z.string().max(80).optional(),
          productId: z.string().optional(),
          issue: z.string().min(10).max(3000),
          faultCode: z.string().max(60).optional(),
          priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
          assignedToId: z.string().optional(),
        })
        .parse(request.body);

      if (!body.customerId && !body.phone) {
        throw new AppError(422, 'Provide a customer or phone number', 'CUSTOMER_REQUIRED');
      }

      const ticket = await createTicket({
        ...body,
        phone: body.phone?.replace(/\s+/g, ''),
        createdById: request.user.sub,
      });

      return reply.code(201).send(ticket);
    },
  );

  app.patch(
    '/tickets/:id',
    { preHandler: [app.authenticate, app.authorize('SUPPORT', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
          resolution: z.string().max(3000).optional(),
          laborCharge: z.coerce.number().int().min(0).optional(),
          partsCharge: z.coerce.number().int().min(0).optional(),
          assignedToId: z.string().nullable().optional(),
          priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
          message: z.string().max(2000).optional(),
        })
        .parse(request.body);

      return updateTicket(id, body, request.user.sub);
    },
  );

  app.post(
    '/tickets/:id/updates',
    { preHandler: [app.authenticate, app.authorize('SUPPORT', 'DIRECTOR', 'TECHNICIAN', 'SALES')] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          message: z.string().min(2).max(3000),
          status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(),
        })
        .parse(request.body);

      const ticket = await prisma.ticket.findUnique({ where: { id } });
      if (!ticket) throw notFound('Ticket');

      if (body.status) {
        return updateTicket(id, { status: body.status, message: body.message }, request.user.sub);
      }

      const update = await prisma.ticketUpdate.create({
        data: { ticketId: id, authorId: request.user.sub, message: body.message },
        include: { author: { select: { id: true, name: true, role: true } } },
      });

      await audit(request.user.sub, 'TICKET_NOTE_ADDED', 'Ticket', id);
      return reply.code(201).send(update);
    },
  );

  app.post(
    '/tickets/:id/approve-repair',
    { preHandler: [app.authenticate, app.authorize('SUPPORT', 'DIRECTOR', 'SALES')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          technicianId: z.string().optional(),
          scheduledDate: z.string().optional(),
          scheduledSlot: z.string().optional(),
          notes: z.string().optional(),
        })
        .parse(request.body ?? {});

      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: { customer: true },
      });
      if (!ticket) throw notFound('Ticket');

      const isWarranty = ticket.warrantyStatus === 'IN_WARRANTY';
      const now = new Date();

      const defaultTech = await prisma.user.findFirst({
        where: { role: 'TECHNICIAN', active: true },
        orderBy: { createdAt: 'asc' },
      });

      const targetTechId = body.technicianId || ticket.assignedToId || defaultTech?.id;
      const schedDate = body.scheduledDate ? new Date(body.scheduledDate) : now;

      const updated = await prisma.$transaction(async (tx) => {
        const updatedTicket = await tx.ticket.update({
          where: { id },
          data: {
            billable: !isWarranty,
            approvedAt: now,
            approvedBy: request.user.sub,
            assignedToId: targetTechId,
            status: 'IN_PROGRESS',
            laborCharge: isWarranty ? 0 : ticket.laborCharge,
            partsCharge: isWarranty ? 0 : ticket.partsCharge,
            totalCharge: isWarranty ? 0 : ticket.totalCharge,
          },
          include: ticketDetailInclude,
        });

        const repairJob = await tx.job.create({
          data: {
            jobNumber: await nextJobNumber(),
            ticketId: ticket.id,
            customerId: ticket.customerId,
            type: 'REPAIR',
            technicianId: targetTechId,
            scheduledDate: schedDate,
            scheduledSlot: body.scheduledSlot || '10:00 - 13:00',
            notes: `Approved ${ticket.inspectionOutcome || 'REPAIR'} for ${ticket.customer.name} (Ticket ${ticket.ticketNumber}). ${
              isWarranty ? '✓ UNDER WARRANTY (100% Free Coverage)' : `BILLABLE: ₹${ticket.totalCharge}`
            }. Notes: ${body.notes || ticket.inspectionNotes || ticket.issue}`,
          },
        });

        await tx.ticketUpdate.create({
          data: {
            ticketId: ticket.id,
            authorId: request.user.sub,
            message: `Support verified warranty: ${
              isWarranty ? 'IN WARRANTY (Auto-approved 100% free repair)' : `OUT OF WARRANTY (Approved billable ₹${ticket.totalCharge})`
            }. Scheduled Repair Job #${repairJob.jobNumber} for technician.`,
            statusTo: 'IN_PROGRESS',
          },
        });

        return { ticket: updatedTicket, job: repairJob };
      });

      await audit(request.user.sub, 'TICKET_REPAIR_APPROVED', 'Ticket', id, {
        isWarranty,
        jobId: updated.job.id,
      });

      return updated;
    },
  );

  app.post(
    '/tickets/:id/generate-bill',
    { preHandler: [app.authenticate, app.authorize('SUPPORT', 'DIRECTOR', 'TECHNICIAN', 'SALES')] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const ticket = await prisma.ticket.findUnique({
        where: { id },
        include: ticketDetailInclude,
      });
      if (!ticket) throw notFound('Ticket');

      let invoice = ticket.invoices[0];
      if (!invoice) {
        const invoiceNumber = await nextInvoiceNumber();
        const subtotal = ticket.billable ? ticket.totalCharge : 0;
        const taxRate = ticket.billable && subtotal > 0 ? 18 : 0;
        const taxAmount = Math.round(subtotal * (taxRate / 100));
        const total = subtotal + taxAmount;
        const now = new Date();

        invoice = await prisma.invoice.create({
          data: {
            invoiceNumber,
            customerId: ticket.customerId,
            ticketId: ticket.id,
            type: 'REPAIR',
            subtotal,
            taxRate,
            taxAmount,
            total,
            status: ticket.billable && total > 0 ? 'SENT' : 'PAID',
            paidAt: ticket.billable && total > 0 ? undefined : now,
            dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
            createdById: request.user.sub,
          },
        });

        await prisma.ticketUpdate.create({
          data: {
            ticketId: ticket.id,
            authorId: request.user.sub,
            message: `Official Service Bill & Tax Invoice #${invoiceNumber} generated (${
              total === 0 ? '₹0 Covered under Warranty' : `₹${total} Billable`
            }).`,
            statusTo: ticket.status,
          },
        });

        await audit(request.user.sub, 'INVOICE_GENERATED', 'Invoice', invoice.id, {
          invoiceNumber,
          ticketId: ticket.id,
          total,
        });
      }

      const refreshed = await prisma.ticket.findUnique({
        where: { id },
        include: ticketDetailInclude,
      });

      return reply.code(200).send({ ticket: refreshed, invoice });
    },
  );

  app.get(
    '/support/lookup',
    { preHandler: [app.authenticate, app.authorize('SUPPORT', 'DIRECTOR', 'SALES')] },
    async (request) => {
      const { q } = z.object({ q: z.string().min(2) }).parse(request.query);
      const term = q.trim();

      const [customers, units, orders, tickets] = await Promise.all([
        prisma.customer.findMany({
          where: {
            OR: [
              { phone: { contains: term } },
              { name: { contains: term, mode: 'insensitive' } },
            ],
          },
          include: {
            orders: {
              select: {
                id: true,
                orderNumber: true,
                status: true,
                total: true,
                balanceDue: true,
                quote: { select: { capacityKw: true, systemType: true } },
              },
              orderBy: { createdAt: 'desc' },
            },
            tickets: {
              select: {
                id: true,
                ticketNumber: true,
                status: true,
                warrantyStatus: true,
                issue: true,
              },
              orderBy: { createdAt: 'desc' },
            },
          },
          take: 10,
        }),
        prisma.inventoryUnit.findMany({
          where: { serialNumber: { contains: term, mode: 'insensitive' } },
          include: {
            product: true,
            order: { include: { customer: true } },
          },
          take: 10,
        }),
        prisma.order.findMany({
          where: { orderNumber: { contains: term, mode: 'insensitive' } },
          include: { customer: true, quote: true, job: true },
          take: 10,
        }),
        prisma.ticket.findMany({
          where: {
            OR: [
              { ticketNumber: { contains: term, mode: 'insensitive' } },
              { serialNumber: { contains: term, mode: 'insensitive' } },
            ],
          },
          include: { customer: true, product: true, assignedTo: { select: { name: true } } },
          take: 10,
        }),
      ]);

      return {
        query: term,
        customers,
        units: units.map((unit) => ({
          ...unit,
          warrantyStatus: warrantyStatus(unit.warrantyEnd),
          warrantyDaysLeft: unit.warrantyEnd
            ? Math.ceil((unit.warrantyEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
            : null,
        })),
        orders,
        tickets,
      };
    },
  );
};
