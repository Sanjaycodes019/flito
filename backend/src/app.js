const express = require('express');
const cors = require('cors');

const errorHandler = require('./middleware/errorHandler');

// The Express app is built separately from the HTTP server so tests can
// exercise it in-process without binding a port or opening a socket server.
// `io` is optional. Controllers push through `req.io?.…`, so real-time
// emits are simply skipped when it is absent.
module.exports = function createApp({ io } = {}) {
  const app = express();

  const allowedOrigins = [
    process.env.FRONTEND_URL,   // production Vercel URL
    'http://localhost:19006',   // Expo web dev
    'http://localhost:8081',
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      cb(new Error('Not allowed by CORS'));
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '2mb' }));

  // Make io available to controllers for targeted real-time pushes.
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/loads', require('./routes/loads'));
  app.use('/api/quotes', require('./routes/quotes'));
  app.use('/api/bookings', require('./routes/bookings'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/trucks', require('./routes/trucks'));
  app.use('/api/locations', require('./routes/locations'));

  app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
  app.use(errorHandler);

  return app;
};
