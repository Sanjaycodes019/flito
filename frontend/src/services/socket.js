import { io } from 'socket.io-client';

const SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:5000';

let socket = null;

export const socketService = {
  // Connects and joins the caller's private room (server verifies the JWT).
  connect: (token) => {
    if (socket?.connected) return socket;

    socket = io(SOCKET_URL, {
      transports: ['websocket'], // skip long-polling, which Render's free proxy handles poorly
      autoConnect: true,
      reconnection: true,
    });

    socket.on('connect', () => {
      console.log('Socket connected:', socket.id);
      if (token) socket.emit('join-room', token);
    });

    socket.on('disconnect', () => console.log('Socket disconnected'));

    return socket;
  },

  on: (event, callback) => socket?.on(event, callback),
  off: (event, callback) => socket?.off(event, callback),
  emit: (event, data) => socket?.emit(event, data),

  disconnect: () => {
    socket?.disconnect();
    socket = null;
  },
};

export default socketService;
