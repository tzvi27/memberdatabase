import { prisma } from '../index';

export async function logAudit(params: {
  entityType: string;
  entityId: string;
  action: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  details?: string;
}) {
  await prisma.auditLog.create({
    data: {
      entityType: params.entityType,
      entityId: params.entityId,
      action: params.action,
      field: params.field || null,
      oldValue: params.oldValue || null,
      newValue: params.newValue || null,
      details: params.details || null,
    },
  });
}
