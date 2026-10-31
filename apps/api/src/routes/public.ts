import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { nextLeadReference } from '../lib/sequence.js';
import { acceptQuote } from '../services/quotes.js';
import { parseForm } from '../lib/multipart.js';
import { createTicket } from '../services/tickets.js';

const inquirySchema = z.object({
  name: z.string().min(2).max(100),
  phone: z.string().min(10).max(15),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().min(5).max(300),
  city: z.string().max(80).optional(),
  state: z.string().max(80).optional(),
  pincode: z.string().max(10).optional(),
  requestedKw: z.coerce.number().int().min(1).max(5),
  systemType: z.enum(['ON_GRID', 'OFF_GRID']).default('ON_GRID'),
  monthlyBill: z.coerce.number().int().min(0).max(1000000).optional(),
  roofAreaSqft: z.coerce.number().int().min(0).max(100000).optional(),
  notes: z.string().max(1000).optional(),
});

const publicTicketSchema = z.object({
  phone: z.string().min(10).max(15),
  serialNumber: z.string().min(4).max(60).optional(),
  issue: z.string().min(10).max(2000),
  faultCode: z.string().max(60).optional(),
});

export const publicRoutes: FastifyPluginAsync = async (app) => {
  app.post(
    '/inquiries',
    { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const body = inquirySchema.parse(request.body);
      const phone = body.phone.replace(/\s+/g, '');

      const sales = await prisma.user.findFirst({
        where: { role: 'SALES', active: true },
        orderBy: { createdAt: 'asc' },
      });

      const customer = await prisma.customer.upsert({
        where: { phone },
        update: {
          name: body.name,
          address: body.address,
          email: body.email || undefined,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          monthlyBill: body.monthlyBill,
          roofAreaSqft: body.roofAreaSqft,
        },
        create: {
          name: body.name,
          phone,
          email: body.email || undefined,
          address: body.address,
          city: body.city,
          state: body.state,
          pincode: body.pincode,
          monthlyBill: body.monthlyBill,
          roofAreaSqft: body.roofAreaSqft,
        },
      });

      const lead = await prisma.lead.create({
        data: {
          reference: await nextLeadReference(),
          customerId: customer.id,
          source: 'WEB_FORM',
          requestedKw: body.requestedKw,
          systemType: body.systemType,
          status: 'NEW',
          assignedToId: sales?.id,
          monthlyBill: body.monthlyBill,
          roofAreaSqft: body.roofAreaSqft,
          notes: body.notes,
        },
      });

      return reply.code(201).send({
        leadId: lead.id,
        reference: lead.reference,
        message: 'Thank you! Our sales team will call you within one working day.',
      });
    },
  );

  app.get('/quotes/:token', async (request) => {
    const { token } = z.object({ token: z.string().min(6) }).parse(request.params);
    const quote = await prisma.quote.findUnique({
      where: { publicToken: token },
      include: {
        items: { orderBy: { sortOrder: 'asc' } },
        customer: {
          select: { id: true, name: true, phone: true, address: true, city: true, state: true },
        },
        order: {
          include: {
            payments: {
              select: {
                id: true,
                amount: true,
                status: true,
                type: true,
                createdAt: true,
              },
              orderBy: { createdAt: 'desc' },
            },
            job: { select: { scheduledDate: true, status: true } },
          },
        },
      },
    });

    if (!quote) throw notFound('Quote');
    if (new Date(quote.validUntil ?? 0).getTime() < Date.now() && quote.status === 'SENT') {
      await prisma.quote.update({ where: { id: quote.id }, data: { status: 'EXPIRED' } });
    }

    return quote;
  });

  app.post('/quotes/:token/accept', async (request) => {
    const { token } = z.object({ token: z.string().min(6) }).parse(request.params);
    return acceptQuote(token);
  });

  app.post('/quotes/:token/payments', async (request, reply) => {
    const { token } = z.object({ token: z.string().min(6) }).parse(request.params);
    const quote = await prisma.quote.findUnique({
      where: { publicToken: token },
      include: { order: { include: { payments: true } } },
    });
    if (!quote) throw notFound('Quote');
    if (!quote.order) {
      throw new AppError(409, 'Please accept the quote before uploading a payment', 'QUOTE_NOT_ACCEPTED');
    }

    const { fields, fileUrl } = await parseForm(request, 'payment');
    if (!fileUrl) {
      throw new AppError(422, 'Please attach a payment screenshot', 'SCREENSHOT_REQUIRED');
    }

    const amount = Number(fields.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      throw new AppError(422, 'Enter a valid payment amount', 'INVALID_AMOUNT');
    }

    const approved = quote.order.payments
      .filter((payment) => payment.status === 'APPROVED')
      .reduce((sum, payment) => sum + payment.amount, 0);
    const balance = Math.max(quote.order.total - approved, 0);
    if (amount > balance) {
      throw new AppError(422, `Payment cannot exceed the balance of ₹${balance}`, 'AMOUNT_TOO_HIGH');
    }

    const type = approved === 0 ? (amount >= balance ? 'FULL' : 'ADVANCE') : 'BALANCE';
    const method = ['UPI', 'CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE'].includes(fields.method)
      ? (fields.method as 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE')
      : 'UPI';

    const payment = await prisma.payment.create({
      data: {
        orderId: quote.order.id,
        amount: Math.round(amount),
        method,
        type,
        status: 'PENDING',
        screenshotUrl: fileUrl,
        reference: fields.reference,
        notes: fields.notes,
      },
    });

    return reply.code(201).send({
      payment,
      message: 'Payment screenshot received. Our office will verify it shortly.',
    });
  });

  app.post('/tickets', { config: { rateLimit: { max: 10, timeWindow: '1 minute' } } }, async (request, reply) => {
    const body = publicTicketSchema.parse(request.body);
    const ticket = await createTicket({
      phone: body.phone.replace(/\s+/g, ''),
      serialNumber: body.serialNumber,
      issue: body.issue,
      faultCode: body.faultCode,
      priority: 'HIGH',
    });

    return reply.code(201).send({
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      warrantyStatus: ticket.warrantyStatus,
      message:
        ticket.warrantyStatus === 'IN_WARRANTY'
          ? 'Good news: this unit is under warranty. Support will contact you shortly.'
          : 'Your ticket is registered. Support will confirm any applicable charges.',
    });
  });

  app.post('/tickets/:ticketNumber/confirm', async (request) => {
    const { ticketNumber } = z.object({ ticketNumber: z.string() }).parse(request.params);
    const body = z.object({ phone: z.string().min(10) }).parse(request.body);

    const ticket = await prisma.ticket.findUnique({
      where: { ticketNumber },
      include: { customer: true },
    });
    if (!ticket) throw notFound('Ticket');
    if (ticket.customer.phone.replace(/\s+/g, '') !== body.phone.replace(/\s+/g, '')) {
      throw new AppError(403, 'Phone number does not match this ticket', 'PHONE_MISMATCH');
    }

    return prisma.ticket.update({
      where: { id: ticket.id },
      data: {
        status: 'CLOSED',
        customerConfirmedAt: new Date(),
        closedAt: new Date(),
        updates: {
          create: {
            message: 'Customer confirmed the repair is working. Ticket closed.',
            statusFrom: ticket.status,
            statusTo: 'CLOSED',
          },
        },
      },
    });
  });

  app.get('/track/:phone', async (request) => {
    const { phone } = z.object({ phone: z.string().min(10) }).parse(request.params);
    const customer = await prisma.customer.findUnique({
      where: { phone: phone.replace(/\s+/g, '') },
      select: {
        name: true,
        phone: true,
        address: true,
        orders: {
          select: {
            orderNumber: true,
            status: true,
            total: true,
            balanceDue: true,
            createdAt: true,
            quote: { select: { capacityKw: true, systemType: true, publicToken: true } },
            job: { select: { scheduledDate: true, status: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
        tickets: {
          select: {
            ticketNumber: true,
            issue: true,
            status: true,
            warrantyStatus: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!customer) throw notFound('Customer');
    return customer;
  });
};
