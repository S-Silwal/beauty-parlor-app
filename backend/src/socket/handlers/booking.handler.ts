import { getIO } from "../socket.server";

// Real-time broadcasting is best-effort: the booking itself has already
// been created/updated and persisted by the time these run, so a missing
// or failed Socket.io layer (e.g. app.ts used without server.ts's
// initSocket(), as in tests) must never turn an already-successful booking
// into a request failure.

export const emitBookingCreated = (booking: any) => {
  try {
    const io = getIO();
    io.to("admin").emit("bookingCreated", booking);
    console.log("📢 New booking broadcasted to admins");
  } catch (err: any) {
    console.warn("⚠️  Skipped booking-created broadcast:", err.message);
  }
};

export const emitBookingUpdated = (booking: any) => {
  try {
    const io = getIO();

    // Notify all admins
    io.to("admin").emit("bookingUpdated", booking);

    // Notify the specific customer
    if (booking.user_id) {
      io.to(`user_${booking.user_id}`).emit("bookingStatusChanged", booking);
    }

    console.log(`📢 Booking ${booking.id} updated and broadcasted`);
  } catch (err: any) {
    console.warn(`⚠️  Skipped booking-updated broadcast for ${booking.id}:`, err.message);
  }
};

// A customer submitted an edit/cancel request — admins should see it show
// up live on the Requests panel without a page refresh.
export const emitChangeRequestCreated = (request: any) => {
  try {
    const io = getIO();
    io.to("admin").emit("changeRequestCreated", request);
    console.log(`📢 New change request (${request.type}) broadcasted to admins`);
  } catch (err: any) {
    console.warn("⚠️  Skipped change-request-created broadcast:", err.message);
  }
};

// An admin approved/declined a request — refresh the admin panel and let
// the customer's own dashboard know their request was resolved.
export const emitChangeRequestResolved = (request: any) => {
  try {
    const io = getIO();
    io.to("admin").emit("changeRequestResolved", request);

    const userId = request.user_id || request.appointment?.user_id;
    if (userId) {
      io.to(`user_${userId}`).emit("changeRequestResolved", request);
    }

    console.log(`📢 Change request ${request.id} resolved (${request.status}) and broadcasted`);
  } catch (err: any) {
    console.warn(`⚠️  Skipped change-request-resolved broadcast for ${request.id}:`, err.message);
  }
};
