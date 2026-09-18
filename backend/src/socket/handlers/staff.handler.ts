import { getIO } from "../socket.server";

// Unlike booking events, staff roster changes are public information (the
// About page's "Meet Our Team" section is unauthenticated) — so this is a
// plain io.emit() with no room restriction, reaching every connected
// client including a visitor who's never logged in. No payload: listeners
// just refetch GET /api/staff, which stays the single source of truth
// (isActive-only) rather than trusting whatever shape gets broadcast here.
//
// Real-time broadcasting is best-effort: the staff row has already been
// created/updated/soft-deleted and persisted by the time this runs, so a
// missing or failed Socket.io layer must never turn an already-successful
// write into a request failure.
export const emitStaffUpdated = () => {
  try {
    const io = getIO();
    io.emit("staffUpdated");
    console.log("📢 Staff roster change broadcasted");
  } catch (err: any) {
    console.warn("⚠️  Skipped staff-updated broadcast:", err.message);
  }
};
