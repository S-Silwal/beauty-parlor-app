import { prisma } from "../config/database";

async function main() {
  const rows = await prisma.$queryRaw`
    SELECT a.id AS booking_1, b.id AS booking_2, a.staff_id,
           a.appointment_date AS start_1, b.appointment_date AS start_2
    FROM appointments a
    JOIN appointments b
      ON a.staff_id = b.staff_id
     AND a.id < b.id
     AND a.status IN ('PENDING','CONFIRMED','CHECKED_IN')
     AND b.status IN ('PENDING','CONFIRMED','CHECKED_IN')
     AND a.appointment_date < b.appointment_date + b.duration * interval '1 minute'
     AND b.appointment_date < a.appointment_date + a.duration * interval '1 minute';
  `;
  console.log(`Found ${(rows as any[]).length} overlapping pair(s)`);
  console.table(rows);
}

main().finally(() => prisma.$disconnect());