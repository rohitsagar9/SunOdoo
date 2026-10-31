import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../lib/prisma.js';
import { mustScan, warrantyStatus } from '../services/warranty.js';

function startOfDay(date = new Date()) {
  const value = new Date(date);
  value.setHours(0, 0, 0, 0);
  return value;
}

function startOfWeek(date = new Date()) {
  const value = startOfDay(date);
  const offset = (value.getDay() + 6) % 7;
  value.setDate(value.getDate() - offset);
  return value;
}

function startOfMonth(date = new Date()) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addDays(date: Date, days: number) {
  const value = new Date(date);
  value.setDate(value.getDate() + days);
  return value;
}

const money = (value: number) => Math.round(value);

export const dashboardRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    '/dashboard/director',
    { preHandler: [app.authenticate, app.authorize('DIRECTOR')] },
    async () => {
      const now = new Date();
      const todayStart = startOfDay(now);
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);
      const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);

      const [
        paymentsMonth,
        paymentsWeek,
        paymentsToday,
        expensesMonth,
        pendingInstallOrders,
        openTickets,
        urgentTickets,
        leadGroups,
        recentPayments,
        receivables,
        upcomingJobs,
        subsidyPending,
        monthTimeLogs,
        completedOrders,
        paymentsSixMonths,
        expensesSixMonths,
        overdueInvoices,
        totalLeads,
        wonLeads,
      ] = await Promise.all([
        prisma.payment.findMany({
          where: { status: 'APPROVED', approvedAt: { gte: monthStart } },
          select: { amount: true, method: true, approvedAt: true },
        }),
        prisma.payment.aggregate({
          where: { status: 'APPROVED', approvedAt: { gte: weekStart } },
          _sum: { amount: true },
        }),
        prisma.payment.aggregate({
          where: { status: 'APPROVED', approvedAt: { gte: todayStart } },
          _sum: { amount: true },
        }),
        prisma.expense.aggregate({
          where: { date: { gte: monthStart } },
          _sum: { amount: true },
        }),
        prisma.order.findMany({
          where: { status: { in: ['ADVANCE_PAID', 'READY_TO_DISPATCH', 'DISPATCHED'] } },
          include: {
            customer: true,
            quote: { select: { capacityKw: true, systemType: true } },
            job: { include: { technician: { select: { name: true } } } },
          },
          orderBy: { createdAt: 'asc' },
          take: 8,
        }),
        prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
        prisma.ticket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] }, priority: 'URGENT' } }),
        prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.payment.findMany({
          where: { status: 'APPROVED' },
          include: { order: { include: { customer: true } }, ticket: { include: { customer: true } } },
          orderBy: { approvedAt: 'desc' },
          take: 8,
        }),
        prisma.order.aggregate({
          where: { status: { notIn: ['CANCELLED', 'COMPLETED'] } },
          _sum: { balanceDue: true },
        }),
        prisma.job.findMany({
          where: {
            scheduledDate: { gte: todayStart },
            status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
          },
          include: { customer: true, technician: { select: { name: true } } },
          orderBy: { scheduledDate: 'asc' },
          take: 8,
        }),
        prisma.subsidyRecord.count({
          where: { status: { in: ['NOT_STARTED', 'DOCUMENTS_PENDING', 'SUBMITTED'] } },
        }),
        prisma.timeLog.findMany({
          where: { clockIn: { gte: monthStart } },
          select: { minutes: true },
        }),
        prisma.order.findMany({
          where: { status: { in: ['INSTALLED', 'COMPLETED'] } },
          include: {
            customer: true,
            quote: { include: { items: { include: { product: true } } } },
            job: { include: { expenses: true } },
          },
          orderBy: { completedAt: 'desc' },
          take: 12,
        }),
        prisma.payment.findMany({
          where: { status: 'APPROVED', approvedAt: { gte: sixMonthsAgo } },
          select: { amount: true, approvedAt: true },
        }),
        prisma.expense.findMany({
          where: { date: { gte: sixMonthsAgo } },
          select: { amount: true, date: true },
        }),
        prisma.invoice.count({ where: { status: 'OVERDUE' } }),
        prisma.lead.count(),
        prisma.lead.count({ where: { status: 'WON' } }),
      ]);

      const revenueMonth = paymentsMonth.reduce((sum, payment) => sum + payment.amount, 0);
      const expenses = expensesMonth._sum.amount ?? 0;

      const jobProfitability = completedOrders.map((order) => {
        const partsCost = order.quote.items.reduce(
          (sum, item) => sum + (item.product?.costPrice ?? 0) * item.quantity,
          0,
        );
        const labourCost = Math.round((order.job?.hoursWorked ?? 0) * 250);
        const otherCost = (order.job?.expenses ?? []).reduce(
          (sum, expense) => sum + expense.amount,
          0,
        );
        const cost = partsCost + labourCost + otherCost;
        const profit = order.total - cost;
        return {
          id: order.id,
          orderNumber: order.orderNumber,
          customer: order.customer.name,
          capacityKw: order.quote.capacityKw,
          systemType: order.quote.systemType,
          revenue: order.total,
          partsCost,
          labourCost,
          otherCost,
          cost,
          profit,
          margin: order.total > 0 ? Math.round((profit / order.total) * 1000) / 10 : 0,
          status: order.status,
          completedAt: order.completedAt,
        };
      });

      const months = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        return {
          key: `${date.getFullYear()}-${date.getMonth()}`,
          label: date.toLocaleString('en-IN', { month: 'short' }),
          revenue: 0,
          expenses: 0,
          profit: 0,
        };
      });

      const bucket = (date: Date | null) => {
        if (!date) return null;
        return months.find((month) => month.key === `${date.getFullYear()}-${date.getMonth()}`);
      };

      for (const payment of paymentsSixMonths) {
        const month = bucket(payment.approvedAt);
        if (month) month.revenue += payment.amount;
      }
      for (const expense of expensesSixMonths) {
        const month = bucket(expense.date);
        if (month) month.expenses += expense.amount;
      }
      for (const month of months) month.profit = month.revenue - month.expenses;

      const paymentMix = Object.entries(
        paymentsMonth.reduce<Record<string, number>>((acc, payment) => {
          acc[payment.method] = (acc[payment.method] ?? 0) + payment.amount;
          return acc;
        }, {}),
      ).map(([method, amount]) => ({ method, amount }));

      const hoursMonth = monthTimeLogs.reduce((sum, log) => sum + (log.minutes ?? 0), 0) / 60;

      return {
        generatedAt: now,
        kpis: {
          revenueToday: paymentsToday._sum.amount ?? 0,
          revenueWeek: paymentsWeek._sum.amount ?? 0,
          revenueMonth,
          expensesMonth: expenses,
          profitMonth: revenueMonth - expenses,
          receivables: receivables._sum.balanceDue ?? 0,
          pendingInstallations: pendingInstallOrders.length,
          openTickets,
          urgentTickets,
          activeJobs: upcomingJobs.length,
          subsidyPending,
          technicianHoursMonth: Math.round(hoursMonth * 10) / 10,
          overdueInvoices,
          conversionRate: totalLeads > 0 ? Math.round((wonLeads / totalLeads) * 1000) / 10 : 0,
          totalLeads,
          wonLeads,
        },
        funnel: leadGroups.map((group) => ({ status: group.status, count: group._count._all })),
        monthly: months.map(({ key, ...month }) => month),
        jobProfitability,
        upcomingJobs,
        recentPayments,
        paymentMix,
        pendingInstallOrders,
      };
    },
  );

  app.get(
    '/dashboard/sales',
    { preHandler: [app.authenticate, app.authorize('SALES', 'DIRECTOR')] },
    async (request) => {
      const now = new Date();
      const weekAgo = addDays(now, -7);
      const todayStart = startOfDay(now);
      const todayEnd = addDays(todayStart, 1);

      const [
        leadGroups,
        newLeads,
        pendingPayments,
        quotesSent,
        quotesAccepted,
        quotesValue,
        surveysToday,
        recentLeads,
        recentPayments,
        myLeads,
        readyForQuoteLeads,
      ] = await Promise.all([
        prisma.lead.groupBy({ by: ['status'], _count: { _all: true } }),
        prisma.lead.count({ where: { createdAt: { gte: weekAgo } } }),
        prisma.payment.findMany({
          where: { status: 'PENDING' },
          include: { order: { include: { customer: true, quote: true } }, submittedBy: true },
          orderBy: { createdAt: 'asc' },
          take: 12,
        }),
        prisma.quote.count({ where: { status: 'SENT' } }),
        prisma.quote.count({ where: { status: 'ACCEPTED' } }),
        prisma.quote.aggregate({ where: { status: { in: ['SENT', 'ACCEPTED'] } }, _sum: { total: true } }),
        prisma.job.count({
          where: { type: 'SURVEY', scheduledDate: { gte: todayStart, lt: todayEnd } },
        }),
        prisma.lead.findMany({
          include: { customer: true, assignedTo: { select: { name: true } }, survey: true },
          orderBy: { createdAt: 'desc' },
          take: 8,
        }),
        prisma.payment.findMany({
          where: { status: 'APPROVED' },
          include: { order: { include: { customer: true } } },
          orderBy: { approvedAt: 'desc' },
          take: 6,
        }),
        prisma.lead.count({ where: { assignedToId: request.user.sub } }),
        prisma.lead.findMany({
          where: {
            status: { in: ['SURVEY_COMPLETED', 'VERIFIED'] },
            survey: { isNot: null },
            quotes: { none: {} },
          },
          include: { customer: true, survey: true },
          orderBy: { updatedAt: 'desc' },
          take: 6,
        }),
      ]);

      return {
        kpis: {
          newLeadsWeek: newLeads,
          myLeads,
          pendingPayments: pendingPayments.length,
          pendingPaymentValue: pendingPayments.reduce((sum, payment) => sum + payment.amount, 0),
          quotesSent,
          quotesAccepted,
          pipelineValue: quotesValue._sum.total ?? 0,
          surveysToday,
          conversionRate:
            leadGroups.reduce((sum, group) => sum + group._count._all, 0) > 0
              ? Math.round(
                  ((leadGroups.find((group) => group.status === 'WON')?._count._all ?? 0) /
                    leadGroups.reduce((sum, group) => sum + group._count._all, 0)) *
                    1000,
                ) / 10
              : 0,
        },
        funnel: leadGroups.map((group) => ({ status: group.status, count: group._count._all })),
        pendingPayments,
        recentLeads,
        recentPayments,
        readyForQuoteLeads: readyForQuoteLeads ?? [],
      };
    },
  );

  app.get(
    '/dashboard/technician',
    { preHandler: [app.authenticate, app.authorize('TECHNICIAN', 'DIRECTOR')] },
    async (request) => {
      const now = new Date();
      const todayStart = startOfDay(now);
      const tomorrow = addDays(todayStart, 1);
      const weekStart = startOfWeek(now);
      const monthStart = startOfMonth(now);
      const technicianId = request.user.role === 'TECHNICIAN' ? request.user.sub : undefined;

      const [todayJobs, upcoming, logs, completedMonth, tickets] = await Promise.all([
        prisma.job.findMany({
          where: {
            ...(technicianId ? { technicianId } : {}),
            scheduledDate: { gte: todayStart, lt: tomorrow },
          },
          include: { customer: true, order: { include: { quote: true } }, signature: true },
          orderBy: { scheduledDate: 'asc' },
        }),
        prisma.job.findMany({
          where: {
            ...(technicianId ? { technicianId } : {}),
            scheduledDate: { gte: tomorrow, lt: addDays(now, 8) },
            status: 'SCHEDULED',
          },
          include: { customer: true, order: { include: { quote: true } } },
          orderBy: { scheduledDate: 'asc' },
          take: 10,
        }),
        prisma.timeLog.findMany({
          where: { ...(technicianId ? { userId: technicianId } : {}), clockIn: { gte: weekStart } },
          select: { minutes: true },
        }),
        prisma.job.count({
          where: {
            ...(technicianId ? { technicianId } : {}),
            status: 'COMPLETED',
            completedAt: { gte: monthStart },
          },
        }),
        prisma.ticket.findMany({
          where: {
            ...(technicianId ? { assignedToId: technicianId } : {}),
            status: { in: ['OPEN', 'IN_PROGRESS'] },
          },
          include: { customer: true, product: true },
          orderBy: { createdAt: 'desc' },
          take: 6,
        }),
      ]);

      const minutes = logs.reduce((sum, log) => sum + (log.minutes ?? 0), 0);

      return {
        kpis: {
          jobsToday: todayJobs.length,
          completedMonth,
          hoursWeek: Math.round((minutes / 60) * 10) / 10,
          openTickets: tickets.length,
          upcoming: upcoming.length,
        },
        todayJobs,
        upcoming,
        tickets,
      };
    },
  );

  app.get(
    '/dashboard/warehouse',
    { preHandler: [app.authenticate, app.authorize('WAREHOUSE', 'DIRECTOR')] },
    async () => {
      const now = new Date();
      const todayStart = startOfDay(now);
      const [queue, dispatchedToday, units] = await Promise.all([
        prisma.order.findMany({
          where: { status: { in: ['ADVANCE_PAID', 'READY_TO_DISPATCH'] } },
          include: {
            customer: true,
            quote: true,
            kitItems: { include: { product: true } },
            inventoryUnits: true,
            job: true,
          },
          orderBy: { createdAt: 'asc' },
        }),
        prisma.order.count({ where: { dispatchAt: { gte: todayStart } } }),
        prisma.inventoryUnit.findMany({
          where: { status: 'IN_STOCK' },
          select: { productId: true },
        }),
      ]);

      const stockCounts = units.reduce<Record<string, number>>((acc, unit) => {
        acc[unit.productId] = (acc[unit.productId] ?? 0) + 1;
        return acc;
      }, {});

      const lowStockProducts = await prisma.product.findMany({
        where: {
          id: { in: Object.entries(stockCounts).filter(([, count]) => count < 2).map(([id]) => id) },
        },
      });

      return {
        kpis: {
          readyToPack: queue.filter((order) => order.status === 'ADVANCE_PAID').length,
          readyToDispatch: queue.filter((order) => order.status === 'READY_TO_DISPATCH').length,
          dispatchedToday,
          lowStock: lowStockProducts.length,
          pendingOrders: queue.length,
        },
        queue: queue.map((order) => {
          const totalItems = order.kitItems.length;
          const packedItems = order.kitItems.filter((item) => item.packed).length;
          const requiredScans = order.kitItems
            .filter((item) => mustScan(item.product.category))
            .reduce((sum, item) => sum + item.quantity, 0);
          const scans = order.inventoryUnits.filter((unit) =>
            ['DISPATCHED', 'INSTALLED'].includes(unit.status),
          ).length;
          return {
            ...order,
            progress: {
              totalItems,
              packedItems,
              requiredScans,
              scans,
              ready: packedItems === totalItems && scans >= requiredScans,
            },
          };
        }),
        lowStockProducts,
      };
    },
  );

  app.get(
    '/dashboard/support',
    { preHandler: [app.authenticate, app.authorize('SUPPORT', 'DIRECTOR')] },
    async () => {
      const now = new Date();
      const [open, inProgress, resolved, warrantyUnits, recentTickets, warrantyCounts] =
        await Promise.all([
          prisma.ticket.count({ where: { status: 'OPEN' } }),
          prisma.ticket.count({ where: { status: 'IN_PROGRESS' } }),
          prisma.ticket.count({ where: { status: 'RESOLVED' } }),
          prisma.inventoryUnit.findMany({
            where: {
              status: 'INSTALLED',
              warrantyEnd: { gte: now, lte: addDays(now, 30) },
            },
            include: { product: true, order: { include: { customer: true } } },
            orderBy: { warrantyEnd: 'asc' },
            take: 8,
          }),
          prisma.ticket.findMany({
            include: {
              customer: true,
              product: true,
              assignedTo: { select: { name: true } },
            },
            orderBy: { createdAt: 'desc' },
            take: 8,
          }),
          prisma.ticket.groupBy({ by: ['warrantyStatus'], _count: { _all: true } }),
        ]);

      return {
        kpis: {
          open,
          inProgress,
          resolved,
          active: open + inProgress,
          warrantyExpiring: warrantyUnits.length,
        },
        warrantyCounts: warrantyCounts.map((row) => ({
          status: row.warrantyStatus,
          count: row._count._all,
        })),
        warrantyUnits: warrantyUnits.map((unit) => ({
          ...unit,
          warrantyStatus: warrantyStatus(unit.warrantyEnd),
          daysLeft: unit.warrantyEnd
            ? Math.ceil((unit.warrantyEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
            : null,
        })),
        recentTickets,
      };
    },
  );
};
