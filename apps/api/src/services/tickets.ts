import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { nextJobNumber, nextTicketNumber } from '../lib/sequence.js';
import { warrantyStatus } from './warranty.js';
import { audit } from '../lib/audit.js';
import type { TicketPriority } from '@prisma/client';

interface CreateTicketInput {
  customerId?: string;
  phone?: string;
  serialNumber?: string;
  productId?: string;
  issue: string;
  faultCode?: string;
  priority?: TicketPriority;
  assignedToId?: string;
  createdById?: string | null;
}

export async function createTicket(input: CreateTicketInput) {
  const customer = input.customerId
    ? await prisma.customer.findUnique({ where: { id: input.customerId } })
    : input.phone
      ? await prisma.customer.findUnique({ where: { phone: input.phone } })
      : null;

  if (!customer) throw notFound('Customer');

  const unit = input.serialNumber
    ? await prisma.inventoryUnit.findUnique({
        where: { serialNumber: input.serialNumber },
        include: { product: true, order: true },
      })
    : null;

  const status = warrantyStatus(unit?.warrantyEnd);
  const ticketNumber = await nextTicketNumber();

  const ticket = await prisma.ticket.create({
    data: {
      ticketNumber,
      customerId: customer.id,
      orderId: unit?.orderId ?? undefined,
      productId: input.productId ?? unit?.productId,
      serialNumber: input.serialNumber,
      issue: input.issue,
      faultCode: input.faultCode,
      priority: input.priority ?? 'MEDIUM',
      warrantyStatus: status,
      warrantyEnd: unit?.warrantyEnd,
      billable: status === 'OUT_OF_WARRANTY',
      assignedToId: input.assignedToId,
      updates: {
        create: {
          authorId: input.createdById ?? undefined,
          message: `Ticket raised. Warranty check: ${status.replaceAll('_', ' ').toLowerCase()}.`,
          statusTo: 'OPEN',
        },
      },
    },
    include: {
      customer: true,
      product: true,
      assignedTo: true,
      order: { include: { quote: true } },
    },
  });

  await audit(input.createdById ?? null, 'TICKET_CREATED', 'Ticket', ticket.id, {
    ticketNumber,
    warrantyStatus: status,
  });

  return ticket;
}

export async function updateTicket(
  id: string,
  input: {
    status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
    resolution?: string;
    laborCharge?: number;
    partsCharge?: number;
    assignedToId?: string | null;
    priority?: TicketPriority;
    message?: string;
  },
  userId: string,
) {
  const current = await prisma.ticket.findUnique({ where: { id } });
  if (!current) throw notFound('Ticket');

  const nextStatus = input.status ?? current.status;
  const labor = input.laborCharge ?? current.laborCharge;
  const parts = input.partsCharge ?? current.partsCharge;
  const totalCharge = labor + parts;
  const billable = totalCharge > 0;

  const ticket = await prisma.$transaction(async (tx) => {
    const updated = await tx.ticket.update({
      where: { id },
      data: {
        status: nextStatus,
        resolution: input.resolution ?? current.resolution,
        laborCharge: labor,
        partsCharge: parts,
        totalCharge,
        billable,
        assignedToId: input.assignedToId ?? current.assignedToId,
        priority: input.priority ?? current.priority,
        resolvedAt: nextStatus === 'RESOLVED' && !current.resolvedAt ? new Date() : current.resolvedAt,
        closedAt: nextStatus === 'CLOSED' ? new Date() : current.closedAt,
        updates:
          input.message || nextStatus !== current.status
            ? {
                create: {
                  authorId: userId,
                  message:
                    input.message ??
                    `Status changed from ${current.status.replaceAll('_', ' ')} to ${nextStatus.replaceAll('_', ' ')}.`,
                  statusFrom: current.status,
                  statusTo: nextStatus,
                },
              }
            : undefined,
      },
      include: { customer: true, product: true, updates: { orderBy: { createdAt: 'asc' } } },
    });

    if (nextStatus === 'RESOLVED' && billable) {
      const existing = await tx.invoice.findFirst({ where: { ticketId: id } });
      if (!existing) {
        const invoiceNumber = `SP-INV-${new Date().getFullYear()}-${String(
          (await tx.invoice.count()) + 1,
        ).padStart(4, '0')}`;
        const taxRate = 18;
        const subtotal = labor + parts;
        const taxAmount = Math.round(subtotal * (taxRate / 100));
        await tx.invoice.create({
          data: {
            invoiceNumber,
            customerId: current.customerId,
            ticketId: id,
            type: 'REPAIR',
            subtotal,
            taxRate,
            taxAmount,
            total: subtotal + taxAmount,
            status: 'SENT',
            dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            createdById: userId,
          },
        });
      }
    }

    if (input.assignedToId) {
      const technician = await tx.user.findUnique({ where: { id: input.assignedToId } });
      if (technician && technician.role === 'TECHNICIAN') {
        const existingJob = await tx.job.findFirst({
          where: {
            customerId: current.customerId,
            type: 'REPAIR',
            notes: { contains: current.ticketNumber },
            status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          },
        });
        if (!existingJob) {
          await tx.job.create({
            data: {
              jobNumber: await nextJobNumber(),
              customerId: current.customerId,
              orderId: current.orderId ?? undefined,
              type: 'REPAIR',
              technicianId: input.assignedToId,
              scheduledDate: new Date(),
              scheduledSlot: '09:00 - 12:00',
              notes: `Repair for Ticket ${current.ticketNumber}: ${current.issue}`,
            },
          });
        } else if (existingJob.technicianId !== input.assignedToId) {
          await tx.job.update({
            where: { id: existingJob.id },
            data: { technicianId: input.assignedToId },
          });
        }
      }
    }

    return updated;
  });

  await audit(userId, 'TICKET_UPDATED', 'Ticket', id, { status: nextStatus, billable });
  return ticket;
}
