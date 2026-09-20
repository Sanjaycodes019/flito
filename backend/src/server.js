require('dotenv').config();
const logger = require('./utils/logger');
const http = require('http');
const mongoose = require('mongoose');
const { Server } = require('socket.io');

const { sentryEnabled, Sentry } = require('./config/sentry');
const validateEnv = require('./config/validateEnv');
const connectDB = require('./config/database');
const createApp = require('./app');
const setupSocketHandlers = require('./socket/handlers');
const { startExpirySweep } = require('./services/expiry');
const { setIo } = require('./services/push');

validateEnv();

const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:19006',
  'http://localhost:8081',
].filter(Boolean);

// io needs the raw HTTP server and the app needs io, so the server is created
// bare, io attaches to it, then the Express app is wired in as its request
// handler, avoiding a circular construction.
const bootstrap = async () => {
  const server = http.createServer();

  const io = new Server(server, {
    cors: { origin: allowedOrigins, credentials: true },
  });
  setupSocketHandlers(io);
  setIo(io);

  server.on('request', createApp({ io }));

  await connectDB();
  startExpirySweep();

  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => logger.info(`FLITO backend running on port ${PORT}`));

  // Render sends SIGTERM on every deploy: stop taking connections, let
  // in-flight requests finish, then close the database.
  const shutdown = (signal) => {
    logger.info(`${signal} received, shutting down`);
    const force = setTimeout(() => process.exit(1), 10000);
    force.unref();
    io.close();
    server.close(async () => {
      await mongoose.connection.close();
      process.exit(0);
    });
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
};

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled rejection:', reason);
  if (sentryEnabled) Sentry.captureException(reason);
});

bootstrap();
