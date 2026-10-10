import { io } from 'socket.io-client';

// One Socket.IO connection per credential (anonymous, crew, hospital, dispatch).
// Events only carry ids; screens refetch through the REST API, which enforces access.
const pool = new Map();

export const getSocket = (token = null) => {
  const key = token || 'anonymous';
  if (!pool.has(key)) {
    pool.set(key, io(import.meta.env.VITE_API_URL || '/', { auth: token ? { token } : {}, transports: ['websocket', 'polling'] }));
  }
  return pool.get(key);
};

export const closeSocket = (token) => {
  const socket = pool.get(token);
  if (socket) {
    socket.disconnect();
    pool.delete(token);
  }
};
