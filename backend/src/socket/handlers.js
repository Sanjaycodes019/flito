const logger = require('../utils/logger');
const jwt = require('jsonwebtoken');
const events = require('./events');

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

    // High-frequency GPS pings go straight over the socket (bypassing REST)
    // for lower latency; the driver also periodically persists location via
    // PATCH /api/bookings/:id/location.
    socket.on('location-update', (data) => {
      const { shipperId, ownerId, bookingId, lat, lng } = data || {};
      if (shipperId) io.to(`user-${shipperId}`).emit(events.LOCATION_UPDATE, { bookingId, lat, lng });
      if (ownerId) io.to(`user-${ownerId}`).emit(events.LOCATION_UPDATE, { bookingId, lat, lng });
    });

    socket.on('disconnect', () => {
      logger.info('Socket disconnected:', socket.id);
    });
  });
};

module.exports = setupSocketHandlers;
