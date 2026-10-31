import { prisma } from './prisma.js';

export async function audit(
  userId: string | null,
  action: string,
  entity: string,
  entityId?: string,
  meta?: Record<string, unknown>,
) {
  try {
    await prisma.auditLog.create({
      data: {
        userId: userId ?? undefined,
        action,
        entity,
        entityId,
        meta: meta as never,
      },
    });
  } catch {
    // Audit logging must never break a business transaction.
  }
}
