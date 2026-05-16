// src/socket/index.ts
// Barrel file - Makes importing clean

export { initSocket, getIO } from "./socket.server";
export { 
  emitBookingCreated, 
  emitBookingUpdated 
} from "./handlers/booking.handler";