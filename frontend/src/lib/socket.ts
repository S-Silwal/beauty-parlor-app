// frontend/src/lib/socket.ts
import { io } from 'socket.io-client';
import type { Socket } from 'socket.io-client';

let socket: Socket;

export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
      withCredentials: true,
    });

    socket.on('connect', () => {
      console.log('🟢 Connected to Socket.io');
    });
  }
  return socket;
};

export const getSocket = (): Socket | undefined => socket;