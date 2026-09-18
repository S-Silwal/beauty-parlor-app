// src/scripts/fix-duplicate-bookings.ts
//
// One-off cleanup for the double-booking bug: finds customers holding two
// or more overlapping ACTIVE (PENDING/CONFIRMED) appointments — the exact
// shape of the bug reported against the admin Recent Bookings view (same
// customerId, same service, same start time, one CONFIRMED + one PENDING)
// — and cancels every duplicate but one per overlapping cluster.
//
// This does NOT touch the overlap-checking logic itself (see
// assertSlotAvailable() in appointment.service.ts for the actual fix) —
// it only repairs data that was already double-booked before that fix
// shipped.
//
// Usage:
//   npx ts-node src/scripts/fix-duplicate-bookings.ts            # dry run — prints only, writes nothing
//   npx ts-node src/scripts/fix-duplicate-bookings.ts --apply    # actually cancels the duplicates
//
// Which row survives, per overlapping cluster:
//   1. Prefer CONFIRMED over PENDING (matches "Keep the CONFIRMED row" in
//      the bug report).
//   2. Tie-break by the earliest created_at — the original booking, not
//      whatever raced in after it.
// Every row that doesn't survive is set to CANCELLED with
// cancellation_reason = "duplicate_same_slot". Nothing else about the
// customer's other, non-overlapping bookings is touched.

import { prisma } from "../config/database";
import { AppointmentStatus } from "@prisma/client";

const ACTIVE: AppointmentStatus[] = ["PENDING", "CONFIRMED"];

function overlaps(aStart: Date, aDur: number, bStart: Date, bDur: number): boolean {
  const aEnd = new Date(aStart.getTime() + (aDur || 30) * 60 * 1000);
  const bEnd = new Date(bStart.getTime() + (bDur || 30) * 60 * 1000);
  return aStart < bEnd && bStart < aEnd;
}

async function main() {
  const apply = process.argv.includes("--apply");

  const activeAppointments = await prisma.appointment.findMany({
    where: { status: { in: ACTIVE } },
    orderBy: [{ user_id: "asc" }, { appointment_date: "asc" }],
    include: {
      user: { select: { name: true, email: true } },
      service: { select: { name: true } },
      staff: { select: { name: true } },
    },
  });

  // Group by customer.
  const byCustomer = new Map<string, typeof activeAppointments>();
  for (const a of activeAppointments) {
    const list = byCustomer.get(a.user_id) ?? [];
    list.push(a);
    byCustomer.set(a.user_id, list);
  }

  const toCancel: typeof activeAppointments = [];

  for (const bookings of byCustomer.values()) {
    if (bookings.length < 2) continue;

    // Cluster this customer's bookings by pairwise time overlap. Per-
    // customer lists are always small, so O(n^2) clustering is fine.
    const clusters: (typeof bookings)[] = [];
    for (const booking of bookings) {
      let placed = false;
      for (const cluster of clusters) {
        if (cluster.some((b) => overlaps(b.appointment_date, b.duration, booking.appointment_date, booking.duration))) {
          cluster.push(booking);
          placed = true;
          break;
        }
      }
      if (!placed) clusters.push([booking]);
    }

    for (const cluster of clusters) {
      if (cluster.length < 2) continue;

      const survivor = [...cluster].sort((a, b) => {
        if (a.status !== b.status) return a.status === "CONFIRMED" ? -1 : 1;
        return a.created_at.getTime() - b.created_at.getTime();
      })[0];

      for (const booking of cluster) {
        if (booking.id !== survivor.id) toCancel.push(booking);
      }
    }
  }

  if (toCancel.length === 0) {
    console.log("No duplicate/overlapping active bookings found. Nothing to do.");
    return;
  }

  console.log(`Found ${toCancel.length} duplicate booking(s) to cancel:\n`);
  for (const b of toCancel) {
    console.log(
      `  - ${b.id}  ${b.user.name} <${b.user.email}>  ${b.service.name}  ` +
      `${b.appointment_date.toISOString()}  staff=${b.staff?.name ?? "unassigned"}  status=${b.status}`
    );
  }

  if (!apply) {
    console.log(`\nDry run only — no changes made. Re-run with --apply to cancel these ${toCancel.length} row(s).`);
    return;
  }

  const result = await prisma.appointment.updateMany({
    where: { id: { in: toCancel.map((b) => b.id) } },
    data: {
      status: "CANCELLED" as AppointmentStatus,
      cancellation_reason: "duplicate_same_slot",
    },
  });

  console.log(`\nCancelled ${result.count} duplicate booking(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
