import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { saveDataUrl, saveUpload } from '../lib/files.js';
import { parseForm } from '../lib/multipart.js';
import { addMonths } from '../services/warranty.js';
import { nextInvoiceNumber } from '../lib/sequence.js';
import { audit } from '../lib/audit.js';

const jobInclude = {
  customer: true,
  lead: {
    include: {
      survey: true,
      orders: {
        include: {
          job: { select: { id: true, jobNumber: true, status: true, scheduledDate: true, type: true } },
        },
        orderBy: { createdAt: 'desc' as const },
      },
    },
  },
  technician: { select: { id: true, name: true, phone: true } },
  order: {
    include: {
      quote: { include: { items: { orderBy: { sortOrder: 'asc' as const } } } },
      payments: { orderBy: { createdAt: 'desc' as const } },
      kitItems: { include: { product: true } },
      inventoryUnits: { include: { product: true } },
    },
  },
  ticket: {
    include: {
      customer: true,
      product: true,
      inventoryUnit: true,
      invoices: true,
    },
  },
  photos: { orderBy: { createdAt: 'desc' as const } },
  signature: true,
  timeLogs: { orderBy: { clockIn: 'desc' as const } },
} as const;

async function getJob(id: string) {
  const job = await prisma.job.findUnique({ where: { id }, include: jobInclude });
  if (!job) throw notFound('Job');
  return job;
}

export const jobRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/jobs',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'SALES', 'DIRECTOR')] },
    async (request) => {
      const query = z
        .object({
          date: z.string().optional(),
          status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
          mine: z.coerce.boolean().optional(),
          technicianId: z.string().optional(),
        })
        .parse(request.query);

      let dateFilter = {};
      if (query.date) {
        const parsed = new Date(`${query.date}T00:00:00`);
        if (!isNaN(parsed.getTime())) {
          const start = parsed;
          const end = new Date(`${query.date}T23:59:59.999`);
          dateFilter = { scheduledDate: { gte: start, lte: end } };
        }
      }

      return prisma.job.findMany({
        where: {
          ...dateFilter,
          ...(query.status ? { status: query.status } : {}),
          ...(query.mine || request.user.role === 'TECHNICIAN'
            ? { technicianId: request.user.sub }
            : query.technicianId
              ? { technicianId: query.technicianId }
              : {}),
        },
        include: {
          customer: true,
          technician: { select: { id: true, name: true } },
          order: { include: { quote: true } },
          photos: { take: 1, orderBy: { createdAt: 'desc' } },
          signature: true,
        },
        orderBy: [{ scheduledDate: 'asc' }],
      });
    },
  );

  app.get(
    '/jobs/:id',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const job = await getJob(id);
      if (request.user.role === 'TECHNICIAN' && job.technicianId !== request.user.sub) {
        throw new AppError(403, 'This job is assigned to another technician', 'NOT_YOUR_JOB');
      }
      return job;
    },
  );

  app.patch(
    '/jobs/:id',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          technicianId: z.string().nullable().optional(),
          scheduledDate: z.coerce.date().optional(),
          scheduledSlot: z.string().max(40).optional(),
          status: z.enum(['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED']).optional(),
          notes: z.string().max(2000).optional(),
        })
        .parse(request.body);

      await getJob(id);
      const job = await prisma.job.update({ where: { id }, data: body, include: jobInclude });
      await audit(request.user.sub, 'JOB_UPDATED', 'Job', id, body);
      return job;
    },
  );

  app.post(
    '/jobs/:id/clock-in',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR', 'SALES')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const job = await getJob(id);
      if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
        throw new AppError(409, 'This job is already closed', 'JOB_CLOSED');
      }

      if (job.type === 'INSTALLATION' && job.order && job.order.status === 'PENDING_PAYMENT') {
        throw new AppError(
          409,
          'Customer advance payment is pending. Technicians can only clock in and start installation work after payment has been received and approved by the office.',
          'PAYMENT_REQUIRED',
        );
      }

      const open = job.timeLogs.find((log) => !log.clockOut);
      if (open) return { job, timeLog: open, alreadyClockedIn: true };

      const now = new Date();
      const timeLog = await prisma.timeLog.create({
        data: { jobId: id, userId: request.user.sub, clockIn: now },
      });
      const updated = await prisma.job.update({
        where: { id },
        data: {
          status: 'IN_PROGRESS',
          clockInAt: job.clockInAt ?? now,
        },
        include: jobInclude,
      });

      await audit(request.user.sub, 'JOB_CLOCK_IN', 'Job', id, { timeLogId: timeLog.id });
      return { job: updated, timeLog, alreadyClockedIn: false };
    },
  );

  app.post(
    '/jobs/:id/clock-out',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR', 'SALES')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const job = await getJob(id);
      if (job.type === 'INSTALLATION' && job.order && job.order.status === 'PENDING_PAYMENT') {
        throw new AppError(
          409,
          'Customer advance payment is pending. Technicians can only clock in and start installation work after payment has been received and approved by the office.',
          'PAYMENT_REQUIRED',
        );
      }

      const open = job.timeLogs.find((log) => !log.clockOut);
      if (!open) throw new AppError(409, 'Clock in before clocking out', 'NOT_CLOCKED_IN');

      const now = new Date();
      const minutes = Math.max(1, Math.round((now.getTime() - open.clockIn.getTime()) / 60000));
      await prisma.timeLog.update({
        where: { id: open.id },
        data: { clockOut: now, minutes },
      });

      const logs = await prisma.timeLog.findMany({ where: { jobId: id } });
      const totalMinutes = logs.reduce((sum, log) => sum + (log.minutes ?? 0), 0);
      const updated = await prisma.job.update({
        where: { id },
        data: {
          clockOutAt: now,
          hoursWorked: Math.round((totalMinutes / 60) * 100) / 100,
        },
        include: jobInclude,
      });

      await audit(request.user.sub, 'JOB_CLOCK_OUT', 'Job', id, { minutes });
      return { job: updated, minutes, totalMinutes };
    },
  );

  app.post(
    '/jobs/:id/photos',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR', 'SALES')] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      await getJob(id);

      const file = await request.file();
      if (!file) throw new AppError(422, 'Attach a roof photo', 'PHOTO_REQUIRED');
      const url = await saveUpload(file, 'job-photo');
      const captionField = file.fields?.caption;
      const caption =
        captionField && 'value' in captionField ? String(captionField.value ?? '') : undefined;

      const photo = await prisma.jobPhoto.create({
        data: { jobId: id, url, caption, uploadedById: request.user.sub },
      });

      await audit(request.user.sub, 'JOB_PHOTO_UPLOADED', 'Job', id, { photoId: photo.id });
      return reply.code(201).send(photo);
    },
  );

  app.post(
    '/jobs/:id/signature',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR', 'SALES')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          signerName: z.string().min(2).max(100),
          dataUrl: z.string().min(100),
        })
        .parse(request.body);

      await getJob(id);
      const url = await saveDataUrl(body.dataUrl, 'signature');

      const signature = await prisma.jobSignature.upsert({
        where: { jobId: id },
        update: { signerName: body.signerName, dataUrl: url, signedAt: new Date() },
        create: { jobId: id, signerName: body.signerName, dataUrl: url },
      });

      await audit(request.user.sub, 'JOB_SIGNED', 'Job', id, { signerName: body.signerName });
      return signature;
    },
  );

  app.post(
    '/jobs/:id/payments',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'SALES', 'DIRECTOR')] },
    async (request, reply) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const job = await getJob(id);
      if (!job.order) {
        throw new AppError(422, 'This job has no order to collect payment against', 'NO_ORDER');
      }

      const { fields, fileUrl } = await parseForm(request, 'site-payment');
      const amount = Number(fields.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new AppError(422, 'Enter a valid payment amount', 'INVALID_AMOUNT');
      }
      if (amount > job.order.balanceDue) {
        throw new AppError(422, `Amount exceeds the balance of ₹${job.order.balanceDue}`, 'AMOUNT_TOO_HIGH');
      }

      const method = ['UPI', 'CASH', 'BANK_TRANSFER', 'CARD', 'CHEQUE'].includes(fields.method)
        ? (fields.method as 'UPI' | 'CASH' | 'BANK_TRANSFER' | 'CARD' | 'CHEQUE')
        : 'CASH';

      const payment = await prisma.payment.create({
        data: {
          orderId: job.order.id,
          amount: Math.round(amount),
          method,
          type: 'BALANCE',
          status: 'PENDING',
          screenshotUrl: fileUrl,
          reference: fields.reference,
          notes: fields.notes,
          submittedById: request.user.sub,
        },
      });

      await audit(request.user.sub, 'SITE_PAYMENT_SUBMITTED', 'Payment', payment.id, {
        orderId: job.order.id,
        amount: payment.amount,
      });
      return reply.code(201).send(payment);
    },
  );

  app.post(
    '/jobs/:id/pickup',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const job = await getJob(id);
      const now = new Date();

      const updated = await prisma.job.update({
        where: { id },
        data: { pickedUpAt: now },
        include: jobInclude,
      });

      if (job.order && job.order.status === 'READY_TO_DISPATCH') {
        await prisma.order.update({
          where: { id: job.order.id },
          data: { status: 'DISPATCHED', dispatchAt: now },
        });
      }

      await audit(request.user.sub, 'JOB_HARDWARE_PICKED_UP', 'Job', id, {
        orderId: job.orderId,
      });

      return updated;
    },
  );

  app.post(
    '/jobs/:id/unload',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const job = await getJob(id);
      const now = new Date();

      const updated = await prisma.job.update({
        where: { id },
        data: {
          unloadedAt: now,
          pickedUpAt: job.pickedUpAt ?? now,
        },
        include: jobInclude,
      });

      await audit(request.user.sub, 'JOB_HARDWARE_UNLOADED', 'Job', id, {
        orderId: job.orderId,
      });

      return updated;
    },
  );

  app.post(
    '/jobs/:id/reject-feasibility',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          reason: z.string().min(3).max(1000),
        })
        .parse(request.body);

      const job = await getJob(id);
      const now = new Date();

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.job.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            completionNotes: `TECHNICIAN ASSESSED NOT FEASIBLE: ${body.reason} (Pending Sales Feasibility Review)`,
          },
          include: jobInclude,
        });

        if (job.leadId) {
          await tx.survey.updateMany({
            where: { leadId: job.leadId },
            data: {
              completedAt: now,
              technicianAssessment: 'NOT_FEASIBLE',
              findings: `[Technician: NOT FEASIBLE] ${body.reason}`,
              approved: false,
            },
          });
        }

        return result;
      });

      await audit(request.user.sub, 'SURVEY_TECHNICIAN_NOT_FEASIBLE', 'Job', id, {
        reason: body.reason,
        leadId: job.leadId,
      });

      return updated;
    },
  );

  app.post(
    '/jobs/:id/survey-feasible',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          roofDirection: z.string().optional(),
          tiltDegrees: z.coerce.number().optional(),
          cableDistanceM: z.coerce.number().optional(),
          shadowFreeAreaSqft: z.coerce.number().optional(),
          findings: z.string().optional(),
        })
        .parse(request.body ?? {});

      const job = await getJob(id);
      const now = new Date();

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.job.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            completionNotes: `TECHNICIAN ASSESSED FEASIBLE (Pending Sales Final Review & Quote)`,
          },
          include: jobInclude,
        });

        if (job.leadId) {
          await tx.survey.updateMany({
            where: { leadId: job.leadId },
            data: {
              completedAt: now,
              technicianAssessment: 'FEASIBLE',
              roofDirection: body.roofDirection,
              tiltDegrees: body.tiltDegrees,
              cableDistanceM: body.cableDistanceM,
              shadowFreeAreaSqft: body.shadowFreeAreaSqft,
              findings: body.findings,
            },
          });
        }

        return result;
      });

      await audit(request.user.sub, 'SURVEY_TECHNICIAN_FEASIBLE', 'Job', id, {
        leadId: job.leadId,
      });

      return updated;
    },
  );

  app.post(
    '/jobs/:id/inspection',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          outcome: z.enum(['REPAIR', 'REPLACEMENT']),
          repairBudget: z.coerce.number().min(0).optional(),
          replacementPart: z.string().optional(),
          notes: z.string().min(3).max(2000),
        })
        .parse(request.body);

      const job = await getJob(id);
      const now = new Date();

      if (!job.ticketId) {
        throw new AppError(422, 'This job is not linked to a support ticket', 'NO_TICKET');
      }

      const budget = body.repairBudget || 0;

      const updated = await prisma.$transaction(async (tx) => {
        await tx.ticket.update({
          where: { id: job.ticketId! },
          data: {
            inspectionOutcome: body.outcome,
            repairBudget: body.outcome === 'REPAIR' ? budget : undefined,
            replacementPart: body.outcome === 'REPLACEMENT' ? body.replacementPart : undefined,
            inspectionNotes: body.notes,
            laborCharge: body.outcome === 'REPAIR' ? budget : 0,
            partsCharge: body.outcome === 'REPLACEMENT' ? budget : 0,
            totalCharge: budget,
            status: 'IN_PROGRESS',
          },
        });

        await tx.ticketUpdate.create({
          data: {
            ticketId: job.ticketId!,
            authorId: request.user.sub,
            message: `Technician on-site inspection complete. Recommended: ${body.outcome}. ${
              body.outcome === 'REPAIR'
                ? `Estimated Repair Budget: ₹${budget}`
                : `Replacement Part: ${body.replacementPart || 'Component'} (Est: ₹${budget})`
            }. Notes: ${body.notes}. Awaiting Support warranty check & approval.`,
            statusTo: 'IN_PROGRESS',
          },
        });

        return tx.job.update({
          where: { id },
          data: {
            completionNotes: `INSPECTION COMPLETE: Recommended ${body.outcome}. ${body.notes}`,
          },
          include: jobInclude,
        });
      });

      await audit(request.user.sub, 'TICKET_INSPECTION_SUBMITTED', 'Job', id, {
        outcome: body.outcome,
        ticketId: job.ticketId,
      });

      return updated;
    },
  );

  app.post(
    '/jobs/:id/complete',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR', 'SALES')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          completionNotes: z.string().max(3000).optional(),
          systemSizeKw: z.coerce.number().min(0.5).max(20).optional(),
          testResult: z.string().max(200).optional(),
        })
        .parse(request.body ?? {});

      const job = await getJob(id);
      if (job.status === 'COMPLETED') return job;

      if ((job.type === 'INSTALLATION' || job.type === 'REPAIR') && !job.signature) {
        throw new AppError(409, 'Capture the customer signature before completing the job', 'SIGNATURE_REQUIRED');
      }
      if ((job.type === 'INSTALLATION' || job.type === 'REPAIR') && job.photos.length === 0) {
        throw new AppError(409, 'Upload at least one photo before completing the job', 'PHOTO_REQUIRED');
      }

      const now = new Date();

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.job.update({
          where: { id },
          data: {
            status: 'COMPLETED',
            completedAt: now,
            completionNotes: [body.completionNotes, body.testResult ? `Test: ${body.testResult}` : null]
              .filter(Boolean)
              .join('\n'),
          },
          include: jobInclude,
        });

        if (job.ticketId) {
          const ticket = await tx.ticket.findUnique({ where: { id: job.ticketId } });
          if (ticket) {
            const existingInvoice = await tx.invoice.findFirst({ where: { ticketId: ticket.id } });
            let invoiceNumber = existingInvoice?.invoiceNumber;
            if (!existingInvoice) {
              invoiceNumber = await nextInvoiceNumber();
              const subtotal = ticket.billable ? ticket.totalCharge : 0;
              const taxRate = ticket.billable ? 18 : 0;
              const taxAmount = Math.round(subtotal * (taxRate / 100));
              const total = subtotal + taxAmount;

              await tx.invoice.create({
                data: {
                  invoiceNumber,
                  customerId: ticket.customerId,
                  ticketId: ticket.id,
                  type: 'REPAIR',
                  subtotal,
                  taxRate,
                  taxAmount,
                  total,
                  status: ticket.billable ? 'SENT' : 'PAID',
                  paidAt: ticket.billable ? undefined : now,
                  dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
                  createdById: request.user.sub,
                },
              });
            }

            await tx.ticket.update({
              where: { id: ticket.id },
              data: {
                status: 'RESOLVED',
                resolvedAt: now,
                resolution: body.completionNotes || 'Repair completed on site with signature and photos.',
              },
            });

            await tx.ticketUpdate.create({
              data: {
                ticketId: ticket.id,
                authorId: request.user.sub,
                message: `Technician completed repair visit with customer signature and proof photos. Generated Repair Bill #${invoiceNumber} (${
                  ticket.billable ? `₹${ticket.totalCharge}` : '₹0 - Covered under warranty'
                }).`,
                statusTo: 'RESOLVED',
              },
            });
          }
        }

        if (job.order) {
          await tx.order.update({
            where: { id: job.order.id },
            data: { status: 'INSTALLED', installedAt: now },
          });

          const units = await tx.inventoryUnit.findMany({
            where: { orderId: job.order.id },
            include: { product: true },
          });
          for (const unit of units) {
            const start = unit.dispatchedAt ?? now;
            await tx.inventoryUnit.update({
              where: { id: unit.id },
              data: {
                status: 'INSTALLED',
                installedAt: now,
                warrantyStart: unit.warrantyStart ?? start,
                warrantyEnd: unit.warrantyEnd ?? addMonths(start, unit.product.warrantyMonths),
              },
            });
          }

          const existingInvoice = await tx.invoice.findFirst({ where: { orderId: job.order.id } });
          if (!existingInvoice) {
            const taxRate = 13.8;
            const subtotal = Math.round(job.order.total / (1 + taxRate / 100));
            await tx.invoice.create({
              data: {
                invoiceNumber: await nextInvoiceNumber(),
                customerId: job.customerId,
                orderId: job.order.id,
                type: 'SALES',
                subtotal,
                taxRate,
                taxAmount: job.order.total - subtotal,
                total: job.order.total,
                status: 'SENT',
                dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
                createdById: request.user.sub,
              },
            });
          }

          await tx.subsidyRecord.updateMany({
            where: { orderId: job.order.id, status: 'NOT_STARTED' },
            data: { status: 'DOCUMENTS_PENDING' },
          });
        }

        if (job.type === 'SURVEY' && job.leadId) {
          await tx.survey.updateMany({
            where: { leadId: job.leadId },
            data: { completedAt: now, findings: body.completionNotes, approved: true },
          });
          await tx.lead.update({ where: { id: job.leadId }, data: { status: 'SURVEY_COMPLETED' } });
        }

        return result;
      });

      await audit(request.user.sub, 'JOB_COMPLETED', 'Job', id, {
        type: job.type,
        orderId: job.orderId,
      });
      return updated;
    },
  );
};
