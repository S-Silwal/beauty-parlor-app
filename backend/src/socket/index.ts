// src/socket/index.ts
// Barrel file - Makes importing clean

export { initSocket, getIO } from "./socket.server";
export {
  emitBookingCreated,
  emitBookingUpdated,
  emitChangeRequestCreated,
  emitChangeRequestResolved,
} from "./handlers/booking.handler";