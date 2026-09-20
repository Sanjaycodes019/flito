const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const mongoSanitize = require('express-mongo-sanitize');
const mongoose = require('mongoose');
const pinoHttp = require('pino-http');

const logger = require('./utils/logger');
const { Sentry, sentryEnabled } = require('./config/sentry');

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
  // Behind Render's proxy: needed so rate limiting sees the client IP.
  app.set('trust proxy', 1);
  app.use(helmet());
  app.use(compression());
  app.use(pinoHttp({
    logger: logger.raw,
    // Health checks poll constantly and would drown out real traffic.
    autoLogging: { ignore: (req) => req.url === '/api/health' },
  }));
  app.use(express.json({ limit: '2mb' }));
  // Strips `$` and `.` keys so request bodies can't inject Mongo operators.
  app.use(mongoSanitize());

  // Make io available to controllers for targeted real-time pushes.
  app.use((req, res, next) => {
    req.io = io;
    next();
  });

  app.get('/api/health', (req, res) => {
    const db = mongoose.connection.readyState === 1 ? 'up' : 'down';
    res.status(db === 'up' || process.env.NODE_ENV === 'test' ? 200 : 503).json({
      status: db === 'up' ? 'ok' : 'degraded',
      db,
      uptime: Math.round(process.uptime()),
    });
  });
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/loads', require('./routes/loads'));
  app.use('/api/quotes', require('./routes/quotes'));
  app.use('/api/bookings', require('./routes/bookings'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/trucks', require('./routes/trucks'));
  app.use('/api/locations', require('./routes/locations'));

  app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));
  if (sentryEnabled) Sentry.setupExpressErrorHandler(app);
  app.use(errorHandler);

  return app;
};
