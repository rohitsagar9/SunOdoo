import type { FastifyPluginAsync } from 'fastify';
import { authRoutes } from './auth.js';
import { publicRoutes } from './public.js';
import { leadRoutes } from './leads.js';
import { quoteRoutes } from './quotes.js';
import { paymentRoutes } from './payments.js';
import { orderRoutes } from './orders.js';
import { inventoryRoutes } from './inventory.js';
import { jobRoutes } from './jobs.js';
import { ticketRoutes } from './tickets.js';
import { dashboardRoutes } from './dashboard.js';
import { productRoutes } from './products.js';
import { expenseRoutes } from './expenses.js';

export const apiRoutes: FastifyPluginAsync = async (app) => {
  await app.register(authRoutes, { prefix: '/auth' });
  await app.register(publicRoutes, { prefix: '/public' });
  await app.register(leadRoutes);
  await app.register(quoteRoutes);
  await app.register(paymentRoutes);
  await app.register(orderRoutes);
  await app.register(inventoryRoutes);
  await app.register(jobRoutes);
  await app.register(ticketRoutes);
  await app.register(dashboardRoutes);
  await app.register(productRoutes);
  await app.register(expenseRoutes);
};
