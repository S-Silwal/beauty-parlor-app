-- Customer-initiated edits/cancellations must be withdrawable before an
-- admin acts on them (see the customer dashboard's "Withdraw request").
-- WITHDRAWN is a new terminal state alongside APPROVED/DECLINED — it never
-- transitions back to PENDING.
ALTER TYPE "ChangeRequestStatus" ADD VALUE 'WITHDRAWN';
