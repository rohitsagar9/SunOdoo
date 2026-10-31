import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { warrantyStatus } from '../services/warranty.js';
import { audit } from '../lib/audit.js';

const unitStatuses = ['IN_STOCK', 'RESERVED', 'DISPATCHED', 'INSTALLED', 'FAULTY', 'RETURNED'] as const;

export const inventoryRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/inventory',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR', 'SALES', 'SUPPORT')] },
    async (request) => {
      const query = z
        .object({
          status: z.enum(unitStatuses).optional(),
          productId: z.string().optional(),
          search: z.string().optional(),
        })
        .parse(request.query);

      return prisma.inventoryUnit.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.productId ? { productId: query.productId } : {}),
          ...(query.search
            ? { serialNumber: { contains: query.search, mode: 'insensitive' } }
            : {}),
        },
        include: {
          product: true,
          order: { include: { customer: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 250,
      });
    },
  );

  app.get(
    '/inventory/summary',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR', 'SALES')] },
    async () => {
      const [products, units] = await Promise.all([
        prisma.product.findMany({
          where: { active: true, category: { not: 'TOOL' } },
          orderBy: { name: 'asc' },
        }),
        prisma.inventoryUnit.findMany({
          select: { productId: true, status: true },
        }),
      ]);

      const counts = new Map<string, Record<string, number>>();
      for (const unit of units) {
        const entry = counts.get(unit.productId) ?? {};
        entry[unit.status] = (entry[unit.status] ?? 0) + 1;
        counts.set(unit.productId, entry);
      }

      return products.map((product) => ({
        product,
        inStock: counts.get(product.id)?.IN_STOCK ?? 0,
        reserved: counts.get(product.id)?.RESERVED ?? 0,
        dispatched: counts.get(product.id)?.DISPATCHED ?? 0,
        installed: counts.get(product.id)?.INSTALLED ?? 0,
        faulty: counts.get(product.id)?.FAULTY ?? 0,
        lowStock: (counts.get(product.id)?.IN_STOCK ?? 0) < 2,
      }));
    },
  );

  app.get(
    '/inventory/serials/:serial',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR', 'SALES', 'SUPPORT', 'TECHNICIAN')] },
    async (request) => {
      const { serial } = z.object({ serial: z.string() }).parse(request.params);
      const unit = await prisma.inventoryUnit.findUnique({
        where: { serialNumber: serial },
        include: {
          product: true,
          order: { include: { customer: true, quote: true } },
        },
      });
      if (!unit) throw notFound('Serial number');
      return {
        ...unit,
        warrantyStatus: warrantyStatus(unit.warrantyEnd),
        warrantyDaysLeft: unit.warrantyEnd
          ? Math.ceil((unit.warrantyEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000))
          : null,
      };
    },
  );

  app.post(
    '/inventory',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR')] },
    async (request, reply) => {
      const body = z
        .object({
          productId: z.string(),
          serialNumber: z.string().min(4).max(80).optional(),
          quantity: z.coerce.number().int().min(1).max(100).default(1),
          warehouseLocation: z.string().max(80).optional(),
        })
        .parse(request.body);

      const product = await prisma.product.findUnique({ where: { id: body.productId } });
      if (!product) throw notFound('Product');

      const serials: string[] = [];
      for (let index = 0; index < body.quantity; index += 1) {
        serials.push(
          body.serialNumber && body.quantity === 1
            ? body.serialNumber.trim()
            : `${product.sku}-${Date.now().toString(36).toUpperCase()}-${String(index + 1).padStart(3, '0')}`,
        );
      }

      const existing = await prisma.inventoryUnit.findMany({
        where: { serialNumber: { in: serials } },
        select: { serialNumber: true },
      });
      if (existing.length > 0) {
        throw new AppError(409, `Serial already exists: ${existing.map((unit) => unit.serialNumber).join(', ')}`, 'SERIAL_TAKEN');
      }

      await prisma.inventoryUnit.createMany({
        data: serials.map((serialNumber) => ({
          productId: product.id,
          serialNumber,
          warehouseLocation: body.warehouseLocation ?? 'Main warehouse',
        })),
      });

      await audit(request.user.sub, 'STOCK_RECEIVED', 'Product', product.id, {
        quantity: body.quantity,
        serials,
      });

      return reply.code(201).send({
        created: serials.length,
        serials,
      });
    },
  );

  app.patch(
    '/inventory/:id/status',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({ status: z.enum(unitStatuses) }).parse(request.body);

      const unit = await prisma.inventoryUnit.findUnique({ where: { id } });
      if (!unit) throw notFound('Inventory unit');

      const updated = await prisma.inventoryUnit.update({
        where: { id },
        data: { status: body.status },
        include: { product: true },
      });
      await audit(request.user.sub, 'UNIT_STATUS_CHANGED', 'InventoryUnit', id, {
        from: unit.status,
        to: body.status,
      });
      return updated;
    },
  );

  app.get(
    '/inventory/restock-requests',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR')] },
    async () => {
      const records = await prisma.expense.findMany({
        where: {
          category: { in: ['RESTOCK_PENDING', 'RESTOCK_APPROVED', 'RESTOCK_REJECTED'] },
        },
        include: { createdBy: { select: { id: true, name: true } } },
        orderBy: { createdAt: 'desc' },
      });

      return records.map((rec) => {
        // Parse metadata from description: [RESTOCK:productId:quantity:unitCost]
        const match = rec.description.match(/\[RESTOCK:([^:]+):(\d+):(\d+)\]/);
        return {
          id: rec.id,
          productId: match ? match[1] : null,
          quantity: match ? Number(match[2]) : 1,
          unitCost: match ? Number(match[3]) : rec.amount,
          totalCost: rec.amount,
          status: rec.category.replace('RESTOCK_', ''),
          description: rec.description.replace(/\[RESTOCK:[^\]]+\]\s*/, ''),
          requestedBy: rec.createdBy?.name ?? 'Warehouse Staff',
          createdAt: rec.createdAt,
          date: rec.date,
        };
      });
    },
  );

  app.post(
    '/inventory/restock-requests',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR')] },
    async (request, reply) => {
      const body = z
        .object({
          productId: z.string().min(1),
          quantity: z.coerce.number().int().min(1).max(500),
          unitCost: z.coerce.number().int().min(1),
          notes: z.string().max(300).optional(),
        })
        .parse(request.body);

      const product = await prisma.product.findUnique({ where: { id: body.productId } });
      if (!product) throw notFound('Product');

      const totalCost = body.quantity * body.unitCost;
      const metaTag = `[RESTOCK:${product.id}:${body.quantity}:${body.unitCost}]`;
      const description = `${metaTag} Restock ${body.quantity}x ${product.name} (${product.sku}) @ ₹${body.unitCost}/unit. Notes: ${body.notes || 'Warehouse low stock'}`;

      const expense = await prisma.expense.create({
        data: {
          category: 'RESTOCK_PENDING',
          description,
          amount: totalCost,
          createdById: request.user.sub,
          date: new Date(),
        },
        include: { createdBy: { select: { id: true, name: true } } },
      });

      await audit(request.user.sub, 'RESTOCK_REQUESTED', 'Expense', expense.id, {
        productId: product.id,
        quantity: body.quantity,
        totalCost,
      });

      return reply.code(201).send({
        id: expense.id,
        productId: product.id,
        quantity: body.quantity,
        unitCost: body.unitCost,
        totalCost,
        status: 'PENDING',
        description: expense.description,
      });
    },
  );

  app.post(
    '/inventory/restock-requests/:id/approve',
    { preHandler: [app.authenticate, app.authorize('DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const expense = await prisma.expense.findUnique({ where: { id } });
      if (!expense) throw notFound('Restock request');
      if (expense.category !== 'RESTOCK_PENDING') {
        throw new AppError(409, 'This restock request has already been processed', 'ALREADY_PROCESSED');
      }

      const match = expense.description.match(/\[RESTOCK:([^:]+):(\d+):(\d+)\]/);
      if (!match) throw new AppError(400, 'Invalid restock request payload', 'INVALID_PAYLOAD');

      const productId = match[1];
      const quantity = Number(match[2]);
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) throw notFound('Product');

      const serials: string[] = [];
      const timestamp = Date.now().toString(36).toUpperCase();
      for (let i = 0; i < quantity; i += 1) {
        serials.push(`${product.sku}-${timestamp}-${String(i + 1).padStart(3, '0')}`);
      }

      await prisma.$transaction(async (tx) => {
        // Approve expense to deduct cost
        await tx.expense.update({
          where: { id },
          data: { category: 'RESTOCK_APPROVED' },
        });

        // Add physical inventory units
        await tx.inventoryUnit.createMany({
          data: serials.map((serialNumber) => ({
            productId: product.id,
            serialNumber,
            warehouseLocation: 'Main warehouse · Restocked',
            status: 'IN_STOCK',
          })),
        });
      });

      await audit(request.user.sub, 'RESTOCK_APPROVED', 'Expense', id, {
        productId,
        quantity,
        amountDeducted: expense.amount,
      });

      return {
        id,
        status: 'APPROVED',
        quantityAdded: quantity,
        productName: product.name,
        amountDeducted: expense.amount,
      };
    },
  );

  app.post(
    '/inventory/restock-requests/:id/reject',
    { preHandler: [app.authenticate, app.authorize('DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const expense = await prisma.expense.findUnique({ where: { id } });
      if (!expense) throw notFound('Restock request');
      if (expense.category !== 'RESTOCK_PENDING') {
        throw new AppError(409, 'This restock request has already been processed', 'ALREADY_PROCESSED');
      }

      await prisma.expense.update({
        where: { id },
        data: { category: 'RESTOCK_REJECTED' },
      });

      await audit(request.user.sub, 'RESTOCK_REJECTED', 'Expense', id, {});
      return { id, status: 'REJECTED' };
    },
  );
};
