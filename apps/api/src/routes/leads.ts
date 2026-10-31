import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { nextJobNumber, nextLeadReference } from '../lib/sequence.js';
import { audit } from '../lib/audit.js';

const leadStatuses = [
  'NEW',
  'VERIFIED',
  'SURVEY_SCHEDULED',
  'SURVEY_COMPLETED',
  'QUOTED',
  'NEGOTIATION',
  'WON',
  'LOST',
] as const;

const createLeadSchema = z.object({
  name: z.string().min(2),
  phone: z.string().min(10).max(15),
  address: z.string().min(5),
  email: z.string().email().optional().or(z.literal('')),
  city: z.string().optional(),
  requestedKw: z.coerce.number().int().min(1).max(5),
  systemType: z.enum(['ON_GRID', 'OFF_GRID']).default('ON_GRID'),
  monthlyBill: z.coerce.number().int().min(0).max(1000000).optional(),
  roofAreaSqft: z.coerce.number().int().min(0).optional(),
  notes: z.string().optional(),
  source: z.enum(['WEB_FORM', 'WHATSAPP', 'PHONE', 'WALK_IN']).default('PHONE'),
  assignedToId: z.string().optional(),
});

const updateLeadSchema = z.object({
  status: z.enum(leadStatuses).optional(),
  assignedToId: z.string().nullable().optional(),
  name: z.string().min(2).optional(),
  phone: z.string().min(10).max(15).optional(),
  address: z.string().min(5).optional(),
  city: z.string().optional(),
  monthlyBill: z.coerce.number().int().min(0).max(1000000).optional(),
  roofAreaSqft: z.coerce.number().int().min(0).optional(),
  notes: z.string().max(3000).optional(),
  lostReason: z.string().max(500).optional(),
  requestedKw: z.coerce.number().int().min(1).max(5).optional(),
  systemType: z.enum(['ON_GRID', 'OFF_GRID']).optional(),
});

export const leadRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/leads',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const query = z
        .object({
          status: z.enum(leadStatuses).optional(),
          search: z.string().optional(),
          mine: z.enum(['true', 'false']).optional(),
        })
        .parse(request.query);

      return prisma.lead.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.mine === 'true' ? { assignedToId: request.user.sub } : {}),
          ...(query.search
            ? {
                OR: [
                  { reference: { contains: query.search, mode: 'insensitive' } },
                  { customer: { name: { contains: query.search, mode: 'insensitive' } } },
                  { customer: { phone: { contains: query.search } } },
                ],
              }
            : {}),
        },
        include: {
          customer: true,
          assignedTo: { select: { id: true, name: true } },
          survey: { include: { technician: { select: { id: true, name: true } } } },
          quotes: { orderBy: { createdAt: 'desc' }, take: 1 },
          orders: { orderBy: { createdAt: 'desc' }, take: 1 },
        },
        orderBy: [{ createdAt: 'desc' }],
      });
    },
  );

  app.get(
    '/leads/:id',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR', 'TECHNICIAN')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const lead = await prisma.lead.findUnique({
        where: { id },
        include: {
          customer: true,
          assignedTo: { select: { id: true, name: true } },
          survey: { include: { technician: { select: { id: true, name: true } } } },
          quotes: {
            include: { items: { orderBy: { sortOrder: 'asc' } }, order: true },
            orderBy: { createdAt: 'desc' },
          },
          orders: {
            include: { payments: true, job: true, kitItems: { include: { product: true } } },
            orderBy: { createdAt: 'desc' },
          },
          jobs: { include: { technician: { select: { id: true, name: true } } } },
        },
      });
      if (!lead) throw notFound('Lead');
      return lead;
    },
  );

  app.post(
    '/leads',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request, reply) => {
      const body = createLeadSchema.parse(request.body);
      const phone = body.phone.replace(/\s+/g, '');

      const customer = await prisma.customer.upsert({
        where: { phone },
        update: {
          name: body.name,
          address: body.address,
          email: body.email || undefined,
          city: body.city,
          monthlyBill: body.monthlyBill,
          roofAreaSqft: body.roofAreaSqft,
        },
        create: {
          name: body.name,
          phone,
          address: body.address,
          email: body.email || undefined,
          city: body.city,
          monthlyBill: body.monthlyBill,
          roofAreaSqft: body.roofAreaSqft,
        },
      });

      const lead = await prisma.lead.create({
        data: {
          reference: await nextLeadReference(),
          customerId: customer.id,
          source: body.source,
          requestedKw: body.requestedKw,
          systemType: body.systemType,
          monthlyBill: body.monthlyBill,
          roofAreaSqft: body.roofAreaSqft,
          notes: body.notes,
          assignedToId: body.assignedToId ?? request.user.sub,
        },
        include: { customer: true, assignedTo: true },
      });

      await audit(request.user.sub, 'LEAD_CREATED', 'Lead', lead.id, { reference: lead.reference });
      return reply.code(201).send(lead);
    },
  );

  app.patch(
    '/leads/:id',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = updateLeadSchema.parse(request.body);
      const existing = await prisma.lead.findUnique({ where: { id } });
      if (!existing) throw notFound('Lead');

      const { name, phone, address, city, ...leadData } = body;
      if (name || phone || address || city) {
        await prisma.customer.update({
          where: { id: existing.customerId },
          data: {
            ...(name ? { name } : {}),
            ...(phone ? { phone: phone.replace(/\s+/g, '') } : {}),
            ...(address ? { address } : {}),
            ...(city ? { city } : {}),
          },
        });
      }

      const lead = await prisma.lead.update({
        where: { id },
        data: leadData,
        include: { customer: true, assignedTo: true, survey: true },
      });

      await audit(request.user.sub, 'LEAD_UPDATED', 'Lead', id, body);
      return lead;
    },
  );

  app.post(
    '/leads/:id/survey',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          technicianId: z.string().min(1),
          scheduledAt: z.coerce.date(),
          slot: z.string().max(40).optional(),
          notes: z.string().max(1000).optional(),
        })
        .parse(request.body);

      const lead = await prisma.lead.findUnique({ where: { id } });
      if (!lead) throw notFound('Lead');

      const technician = await prisma.user.findUnique({ where: { id: body.technicianId } });
      if (!technician || technician.role !== 'TECHNICIAN') {
        throw new AppError(422, 'Choose a valid technician', 'INVALID_TECHNICIAN');
      }

      const result = await prisma.$transaction(async (tx) => {
        const survey = await tx.survey.upsert({
          where: { leadId: id },
          update: {
            technicianId: body.technicianId,
            scheduledAt: body.scheduledAt,
            findings: body.notes,
          },
          create: {
            leadId: id,
            technicianId: body.technicianId,
            scheduledAt: body.scheduledAt,
            findings: body.notes,
          },
        });

        const existingJob = await tx.job.findFirst({ where: { leadId: id, type: 'SURVEY' } });
        if (existingJob) {
          await tx.job.update({
            where: { id: existingJob.id },
            data: {
              technicianId: body.technicianId,
              scheduledDate: body.scheduledAt,
              scheduledSlot: body.slot,
              status: 'SCHEDULED',
            },
          });
        } else {
          await tx.job.create({
            data: {
              jobNumber: await nextJobNumber(),
              leadId: id,
              customerId: lead.customerId,
              type: 'SURVEY',
              technicianId: body.technicianId,
              scheduledDate: body.scheduledAt,
              scheduledSlot: body.slot,
              notes: body.notes,
            },
          });
        }

        await tx.lead.update({ where: { id }, data: { status: 'SURVEY_SCHEDULED' } });
        return survey;
      });

      await audit(request.user.sub, 'SURVEY_SCHEDULED', 'Survey', result.id, {
        leadId: id,
        technicianId: body.technicianId,
      });
      return result;
    },
  );

  app.patch(
    '/surveys/:id',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR', 'TECHNICIAN')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z
        .object({
          roofDirection: z.string().max(80).optional(),
          tiltDegrees: z.coerce.number().int().min(0).max(60).optional(),
          cableDistanceM: z.coerce.number().int().min(0).max(500).optional(),
          shadowFreeAreaSqft: z.coerce.number().int().min(0).max(100000).optional(),
          findings: z.string().max(3000).optional(),
          approved: z.boolean().optional(),
          technicianId: z.string().optional(),
        })
        .parse(request.body);

      const survey = await prisma.survey.findUnique({ where: { id }, include: { lead: true } });
      if (!survey) throw notFound('Survey');

      const updated = await prisma.$transaction(async (tx) => {
        const result = await tx.survey.update({
          where: { id },
          data: {
            ...body,
            completedAt:
              body.roofDirection || body.tiltDegrees || body.cableDistanceM
                ? new Date()
                : survey.completedAt,
          },
          include: { technician: { select: { id: true, name: true } }, lead: true },
        });

        if (body.approved) {
          await tx.lead.update({
            where: { id: survey.leadId },
            data: { status: 'SURVEY_COMPLETED' },
          });
          const surveyJob = await tx.job.findFirst({
            where: { leadId: survey.leadId, type: 'SURVEY' },
          });
          if (surveyJob) {
            await tx.job.update({
              where: { id: surveyJob.id },
              data: { status: 'COMPLETED', completedAt: new Date(), completionNotes: body.findings },
            });
          }
        }

        return result;
      });

      await audit(request.user.sub, 'SURVEY_UPDATED', 'Survey', id, body);
      return updated;
    },
  );
};
