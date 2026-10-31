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
};
