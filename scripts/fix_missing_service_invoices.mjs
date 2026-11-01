import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function run() {
  const tickets = await prisma.ticket.findMany({
    where: {
      status: { in: ['RESOLVED', 'CLOSED'] },
      invoices: { none: {} },
    },
    include: { customer: true },
  });

  console.log(`Found ${tickets.length} resolved/closed tickets without invoices.`);

  const year = new Date().getFullYear();

  for (const ticket of tickets) {
    const last = await prisma.invoice.findFirst({
      where: { invoiceNumber: { startsWith: `SP-INV-${year}-` } },
      orderBy: { invoiceNumber: 'desc' },
      select: { invoiceNumber: true },
    });
    const lastNum = last ? parseInt(last.invoiceNumber.split('-').pop() || '0', 10) : 0;
    const invoiceNumber = `SP-INV-${year}-${String(lastNum + 1).padStart(4, '0')}`;

    const subtotal = ticket.billable ? ticket.totalCharge : 0;
    const taxRate = ticket.billable && subtotal > 0 ? 18 : 0;
    const taxAmount = Math.round(subtotal * (taxRate / 100));
    const total = subtotal + taxAmount;
    const now = ticket.resolvedAt || ticket.closedAt || new Date();

    const inv = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: ticket.customerId,
        ticketId: ticket.id,
        type: 'REPAIR',
        subtotal,
        taxRate,
        taxAmount,
        total,
        status: ticket.billable && total > 0 ? 'SENT' : 'PAID',
        paidAt: ticket.billable && total > 0 ? undefined : now,
        dueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
      },
    });

    console.log(`Generated invoice ${invoiceNumber} for ticket ${ticket.ticketNumber} (${ticket.warrantyStatus}, Total: ₹${total})`);
  }

  await prisma.$disconnect();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
