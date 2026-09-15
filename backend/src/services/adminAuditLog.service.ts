// src/services/adminAuditLog.service.ts
//
// "No admin audit log for price/status/customer-data changes — only
// updated_at, no who/why." (30-day hardening audit.) This gives the
// highest-value mutations (appointment status, service price/details, staff
// records) a real who/what/when trail without trying to boil the ocean and
// log literally every write in the app.
//
// Deliberately fire-and-forget-safe: a failure to WRITE an audit log entry
// must never fail the underlying business operation it's describing (an
// admin changing a price shouldn't 500 because the audit table had a
// hiccup). Callers await it for ordering, but errors are caught and logged
// here, never rethrown.
import { prisma } from "../config/database";
import { Prisma } from "@prisma/client";
import { logger } from "../utils/logger";

export interface AuditActor {
  userId: string;
  role: string;
}

export type AuditAction =
  | "APPOINTMENT_STATUS_UPDATE"
  | "SERVICE_UPDATE"
  | "STAFF_UPDATE";

export type AuditEntityType = "Appointment" | "Service" | "Staff";

/**
 * Builds a { field: { from, to } } diff for just the fields that actually
 * changed between two plain objects — so the log entry only records what's
 * meaningfully different, not a full before/after dump of every column.
 */
export function diffFields<T extends Record<string, unknown>>(
  before: T,
  after: Partial<T>
): Record<string, { from: unknown; to: unknown }> {
  const changes: Record<string, { from: unknown; to: unknown }> = {};
  for (const key of Object.keys(after)) {
    const from = before[key];
    const to = after[key as keyof T];
    if (to === undefined) continue; // field wasn't part of this update at all
    const changed =
      from instanceof Date || to instanceof Date
        ? new Date(from as string | number | Date).getTime() !==
          new Date(to as string | number | Date).getTime()
        : String(from) !== String(to);
    if (changed) changes[key] = { from, to };
  }
  return changes;
}

export async function recordAuditLog(params: {
  actor?: AuditActor;
  action: AuditAction;
  entityType: AuditEntityType;
  entityId: string;
  changes: Record<string, unknown>;
}) {
  // Nothing actually changed (e.g. an update call with no real field
  // changes) — don't clutter the log with a no-op entry.
  if (Object.keys(params.changes).length === 0) return;

  try {
    await prisma.adminAuditLog.create({
      data: {
        actor_user_id: params.actor?.userId ?? null,
        actor_role:    params.actor?.role ?? "SYSTEM",
        action:        params.action,
        entity_type:   params.entityType,
        entity_id:     params.entityId,
        changes:       params.changes as Prisma.InputJsonValue,
      },
    });
  } catch (err: any) {
    logger.error("Failed to write admin audit log entry", {
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      error: err.message,
    });
  }
}
