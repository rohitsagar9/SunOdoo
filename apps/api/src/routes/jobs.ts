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
  lead: { include: { survey: true } },
  technician: { select: { id: true, name: true, phone: true } },
  order: {
    include: {
      quote: { include: { items: { orderBy: { sortOrder: 'asc' as const } } } },
      payments: { orderBy: { createdAt: 'desc' as const } },
      kitItems: { include: { product: true } },
      inventoryUnits: { include: { product: true } },
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
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const job = await getJob(id);
      if (job.status === 'COMPLETED' || job.status === 'CANCELLED') {
        throw new AppError(409, 'This job is already closed', 'JOB_CLOSED');
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
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const job = await getJob(id);
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
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR')] },
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
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR')] },
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
    '/jobs/:id/complete',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR')] },
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

      if (job.type === 'INSTALLATION' && !job.signature) {
        throw new AppError(409, 'Capture the customer signature before completing the job', 'SIGNATURE_REQUIRED');
      }
      if (job.type === 'INSTALLATION' && job.photos.length === 0) {
        throw new AppError(409, 'Upload at least one finished-roof photo before completing the job', 'PHOTO_REQUIRED');
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
