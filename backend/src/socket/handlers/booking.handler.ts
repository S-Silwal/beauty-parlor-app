// src/socket/handlers/booking.handler.ts
import { getIO } from "../socket.server";

export const emitBookingCreated = (booking: any) => {
  const io = getIO();
  io.to("admin").emit("bookingCreated", booking);
  console.log("📢 New booking broadcasted to admins");
};

export const emitBookingUpdated = (booking: any) => {
  const io = getIO();
  
  // Notify all admins
  io.to("admin").emit("bookingUpdated", booking);
  
  // Notify the specific customer
  if (booking.user_id) {
    io.to(`user_${booking.user_id}`).emit("bookingStatusChanged", booking);
  }

  console.log(`📢 Booking ${booking.id} updated and broadcasted`);
};