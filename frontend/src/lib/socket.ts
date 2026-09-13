// src/lib/socket.ts
import { io, type Socket } from 'socket.io-client';
import { api } from './api';

let socket: Socket;

export const initSocket = (): Socket => {
  if (!socket) {
    socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000', {
      withCredentials: true,
      // Re-read the token on every (re)connect attempt so the server can
      // verify identity and assign rooms itself — see socket.server.ts.
      auth: (cb) => cb({ token: api.getToken() }),
    });

    socket.on('connect', () => {
      console.log('Connected to Socket.io');
    });
  }
  return socket;
};

// Call after login/logout so the next reconnect picks up the new token.
export const reconnectSocket = (): void => {
  socket?.disconnect().connect();
};

export const getSocket = (): Socket | undefined => socket;
