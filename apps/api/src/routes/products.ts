import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { audit } from '../lib/audit.js';

const categories = [
  'PANEL',
  'INVERTER',
  'BATTERY',
  'CHARGE_CONTROLLER',
  'STRUCTURE',
  'CABLE',
  'BOS',
  'SERVICE',
  'TOOL',
] as const;

export const productRoutes: FastifyPluginAsync = async (app) => {
  app.get('/catalog', async () => {
    const products = await prisma.product.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return {
      products,
      categories: Object.values(categories),
      upi: {
        id: process.env.UPI_ID ?? 'sunpower@upi',
        name: process.env.UPI_NAME ?? 'SunPower Solutions',
      },
    };
  });

  app.get('/products', { preHandler: [app.authenticate] }, async (request) => {
    const query = z
      .object({
        category: z.enum(categories).optional(),
        search: z.string().optional(),
      })
      .parse(request.query);

    return prisma.product.findMany({
      where: {
        active: true,
        ...(query.category ? { category: query.category } : {}),
        ...(query.search
          ? {
              OR: [
                { name: { contains: query.search, mode: 'insensitive' } },
                { sku: { contains: query.search, mode: 'insensitive' } },
              ],
            }
          : {}),
      },
      include: {
        _count: { select: { inventoryUnits: true } },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });
  });

  app.post(
    '/products',
    { preHandler: [app.authenticate, app.authorize('DIRECTOR', 'WAREHOUSE')] },
    async (request, reply) => {
      const body = z
        .object({
          sku: z.string().min(3).max(40),
          name: z.string().min(3).max(160),
          category: z.enum(categories),
          unit: z.string().min(1).max(20),
          unitPrice: z.coerce.number().int().min(0),
          costPrice: z.coerce.number().int().min(0),
          warrantyMonths: z.coerce.number().int().min(0).max(300).default(24),
          description: z.string().max(500).optional(),
        })
        .parse(request.body);

      const product = await prisma.product.create({
        data: {
          ...body,
          barcodePath: `/barcodes/${body.category.toLowerCase().replaceAll('_', '-')}/${body.sku}.svg`,
        },
      });
      await audit(request.user.sub, 'PRODUCT_CREATED', 'Product', product.id, { sku: product.sku });
      return reply.code(201).send(product);
    },
  );
};
