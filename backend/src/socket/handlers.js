const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');

const setupSocketHandlers = (io) => {
  io.on('connection', (socket) => {
    logger.info('Socket connected:', socket.id);

    // Client authenticates its socket and joins a private per-user room
    // (`user-<id>`) so REST controllers can push targeted events via
    // io.to(`user-${id}`).emit(...).
    socket.on('join-room', (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.join(`user-${decoded.userId}`);
        socket.userId = decoded.userId;
      } catch (err) {
        socket.emit('error', { message: 'Invalid token, room join rejected' });
      }
    });

    // Live GPS goes through PATCH /api/bookings/:id/location, which checks the
    // sender is the booking's driver before it reaches the shipper and owner.
    // There is deliberately no socket path for it: a socket message carries
    // no such check, so anyone connected could move a truck on someone's map.

    socket.on('disconnect', () => {
      logger.info('Socket disconnected:', socket.id);
    });
  });
};

module.exports = setupSocketHandlers;
