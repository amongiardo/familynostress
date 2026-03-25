import prisma from '../prisma';

type AuditInput = {
  familyId: string;
  userId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
};

export async function logAudit(input: AuditInput) {
  try {
    await prisma.auditLog.create({
      data: {
        familyId: input.familyId,
        userId: input.userId || null,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId || null,
        details: input.details as any,
      },
    });
  } catch (error) {
    console.error('audit_log_error', error);
  }
}
