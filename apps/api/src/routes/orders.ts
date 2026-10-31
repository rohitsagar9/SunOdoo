import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { AppError, notFound } from '../lib/errors.js';
import { addMonths, mustScan } from '../services/warranty.js';
import { audit } from '../lib/audit.js';

const orderInclude = {
  customer: true,
  quote: { include: { items: { orderBy: { sortOrder: 'asc' as const } } } },
  lead: true,
  approvedBy: { select: { id: true, name: true } },
  payments: { orderBy: { createdAt: 'desc' as const } },
  kitItems: { include: { product: true } },
  inventoryUnits: { include: { product: true } },
  job: { include: { technician: { select: { id: true, name: true } } } },
} as const;

export const orderRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/orders',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR', 'WAREHOUSE', 'SUPPORT')] },
    async (request) => {
      const query = z
        .object({
          status: z
            .enum([
              'PENDING_PAYMENT',
              'ADVANCE_PAID',
              'READY_TO_DISPATCH',
              'DISPATCHED',
              'INSTALLED',
              'COMPLETED',
              'CANCELLED',
            ])
            .optional(),
          search: z.string().optional(),
        })
        .parse(request.query);

      return prisma.order.findMany({
        where: {
          ...(query.status ? { status: query.status } : {}),
          ...(query.search
            ? {
                OR: [
                  { orderNumber: { contains: query.search, mode: 'insensitive' } },
                  { customer: { name: { contains: query.search, mode: 'insensitive' } } },
                  { customer: { phone: { contains: query.search } } },
                ],
              }
            : {}),
        },
        include: orderInclude,
        orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      });
    },
  );

  app.get(
    '/orders/:id',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR', 'WAREHOUSE', 'SUPPORT', 'TECHNICIAN')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const order = await prisma.order.findUnique({ where: { id }, include: orderInclude });
      if (!order) throw notFound('Order');
      return order;
    },
  );

  app.patch(
    '/orders/:orderId/kit/:itemId',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR')] },
    async (request) => {
      const { orderId, itemId } = z
        .object({ orderId: z.string(), itemId: z.string() })
        .parse(request.params);
      const body = z.object({ packed: z.boolean() }).parse(request.body);

      const item = await prisma.kitItem.findFirst({ where: { id: itemId, orderId } });
      if (!item) throw notFound('Kit item');

      const updated = await prisma.kitItem.update({
        where: { id: itemId },
        data: { packed: body.packed, packedAt: body.packed ? new Date() : null },
        include: { product: true },
      });

      await audit(request.user.sub, 'KIT_ITEM_UPDATED', 'KitItem', itemId, {
        packed: body.packed,
        orderId,
      });
      return updated;
    },
  );

  app.post(
    '/orders/:id/pack-all',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const order = await prisma.order.findUnique({ where: { id }, include: { kitItems: true } });
      if (!order) throw notFound('Order');

      await prisma.kitItem.updateMany({
        where: { orderId: id },
        data: { packed: true, packedAt: new Date() },
      });

      await audit(request.user.sub, 'KIT_PACKED', 'Order', id, { items: order.kitItems.length });
      return prisma.order.findUnique({ where: { id }, include: orderInclude });
    },
  );

  app.post(
    '/orders/:id/scan',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({ serialNumber: z.string().min(3).max(80) }).parse(request.body);

      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          kitItems: { include: { product: true } },
          inventoryUnits: true,
        },
      });
      if (!order) throw notFound('Order');
      if (['DISPATCHED', 'INSTALLED', 'COMPLETED', 'CANCELLED'].includes(order.status)) {
        throw new AppError(409, 'This order has already left the warehouse', 'ORDER_CLOSED');
      }

      const unit = await prisma.inventoryUnit.findUnique({
        where: { serialNumber: body.serialNumber.trim() },
        include: { product: true },
      });
      if (!unit) throw new AppError(404, 'Serial number not found in stock', 'SERIAL_NOT_FOUND');

      if (unit.orderId === order.id && ['DISPATCHED', 'INSTALLED'].includes(unit.status)) {
        return { alreadyScanned: true, unit, message: 'This unit is already scanned for this order.' };
      }
      if (unit.orderId && unit.orderId !== order.id) {
        throw new AppError(409, 'This serial is allocated to another order', 'SERIAL_ALLOCATED');
      }
      if (!['IN_STOCK', 'RESERVED'].includes(unit.status)) {
        throw new AppError(409, `This unit is marked ${unit.status.toLowerCase()}`, 'UNIT_UNAVAILABLE');
      }

      const kit = order.kitItems.find((item) => item.productId === unit.productId);
      if (!kit) {
        throw new AppError(422, `${unit.product.name} is not part of this order's kit`, 'PRODUCT_NOT_IN_KIT');
      }

      const scannedForProduct = order.inventoryUnits.filter(
        (item) => item.productId === unit.productId && ['DISPATCHED', 'INSTALLED'].includes(item.status),
      ).length;
      if (scannedForProduct >= kit.quantity) {
        throw new AppError(
          422,
          `All ${kit.quantity} × ${unit.product.name} already scanned`,
          'QUANTITY_COMPLETE',
        );
      }

      const updated = await prisma.inventoryUnit.update({
        where: { id: unit.id },
        data: { orderId: order.id, status: 'DISPATCHED', dispatchedAt: new Date() },
        include: { product: true },
      });

      if (order.status === 'ADVANCE_PAID') {
        await prisma.order.update({ where: { id: order.id }, data: { status: 'READY_TO_DISPATCH' } });
      }

      await audit(request.user.sub, 'SERIAL_SCANNED', 'InventoryUnit', updated.id, {
        serialNumber: updated.serialNumber,
        orderId: order.id,
      });

      return {
        alreadyScanned: false,
        unit: updated,
        scannedForProduct: scannedForProduct + 1,
        requiredForProduct: kit.quantity,
      };
    },
  );

  app.post(
    '/orders/:id/dispatch',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR')] },
    async (request) => {
      const { id } = z.object({ id: z.string() }).parse(request.params);
      const body = z.object({ force: z.boolean().optional() }).parse(request.body ?? {});
      const order = await prisma.order.findUnique({
        where: { id },
        include: {
          kitItems: { include: { product: true } },
          inventoryUnits: { include: { product: true } },
          job: true,
          customer: true,
        },
      });
      if (!order) throw notFound('Order');
      if (['DISPATCHED', 'INSTALLED', 'COMPLETED'].includes(order.status)) {
        throw new AppError(409, 'This order is already dispatched', 'ALREADY_DISPATCHED');
      }
      if (!['ADVANCE_PAID', 'READY_TO_DISPATCH'].includes(order.status) && !body.force) {
        throw new AppError(409, 'Approve the customer payment before dispatch', 'PAYMENT_PENDING');
      }

      const unpacked = order.kitItems.filter((item) => !item.packed);
      if (unpacked.length > 0 && !body.force) {
        throw new AppError(409, 'Complete the packing checklist before dispatch', 'PACKING_INCOMPLETE', {
          items: unpacked.map((item) => item.product.name),
        });
      }

      const missing = order.kitItems.filter((item) => {
        if (!mustScan(item.product.category)) return false;
        const scanned = order.inventoryUnits.filter(
          (unit) =>
            unit.productId === item.productId &&
            ['DISPATCHED', 'INSTALLED'].includes(unit.status),
        ).length;
        return scanned < item.quantity;
      });
      if (missing.length > 0 && !body.force) {
        throw new AppError(409, 'Scan every inverter, battery and charge controller before dispatch', 'SERIALS_MISSING', {
          items: missing.map((item) => ({
            product: item.product.name,
            required: item.quantity,
            scanned: order.inventoryUnits.filter(
              (unit) => unit.productId === item.productId && ['DISPATCHED', 'INSTALLED'].includes(unit.status),
            ).length,
          })),
        });
      }

      const now = new Date();

      // If force dispatching, automatically mark all unpacked kit items as packed
      if (body.force && unpacked.length > 0) {
        await prisma.kitItem.updateMany({
          where: { orderId: id, packed: false },
          data: { packed: true, packedAt: now, notes: 'Auto-packed during override dispatch' },
        });
      }

      // If force dispatching with missing serials, auto-assign available IN_STOCK units
      if (body.force && missing.length > 0) {
        for (const item of missing) {
          const alreadyAssigned = order.inventoryUnits.filter((u) => u.productId === item.productId).length;
          const needed = item.quantity - alreadyAssigned;
          if (needed > 0) {
            const inStock = await prisma.inventoryUnit.findMany({
              where: { productId: item.productId, status: 'IN_STOCK', orderId: null },
              take: needed,
            });
            for (const unit of inStock) {
              await prisma.inventoryUnit.update({
                where: { id: unit.id },
                data: { orderId: order.id, status: 'DISPATCHED', dispatchedAt: now },
              });
            }
          }
        }
      }

      // Fetch units associated with order for warranty clock initialization
      const units = await prisma.inventoryUnit.findMany({
        where: { orderId: id },
        include: { product: true },
      });

      await prisma.$transaction(async (tx) => {
        await tx.order.update({
          where: { id },
          data: { status: 'DISPATCHED', dispatchAt: now },
        });

        for (const unit of units) {
          await tx.inventoryUnit.update({
            where: { id: unit.id },
            data: {
              status: 'DISPATCHED',
              dispatchedAt: unit.dispatchedAt ?? now,
              warrantyStart: now,
              warrantyEnd: addMonths(now, unit.product.warrantyMonths),
            },
          });
        }

        if (order.job) {
          await tx.job.update({
            where: { id: order.job.id },
            data: { status: 'SCHEDULED', scheduledDate: order.job.scheduledDate ?? addMonths(now, 0) },
          });
        } else {
          const technician = await tx.user.findFirst({
            where: { role: 'TECHNICIAN', active: true },
            orderBy: { createdAt: 'asc' },
          });
          await tx.job.create({
            data: {
              jobNumber: `SP-J-${new Date().getFullYear()}-${String((await tx.job.count()) + 1).padStart(4, '0')}`,
              orderId: order.id,
              leadId: order.leadId,
              customerId: order.customerId,
              type: 'INSTALLATION',
              status: 'SCHEDULED',
              technicianId: technician?.id,
              scheduledDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
              scheduledSlot: '09:00 - 13:00',
              notes: `Installation for ${order.customer.name}. Auto-created upon dispatch.`,
            },
          });
        }
      });

      await audit(request.user.sub, 'ORDER_DISPATCHED', 'Order', id, {
        units: units.length,
        orderNumber: order.orderNumber,
        force: Boolean(body.force),
      });

      return prisma.order.findUnique({
        where: { id },
        include: orderInclude,
      });
    },
  );
};
