require('dotenv').config();
const http = require('http');
const { Server } = require('socket.io');

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
  server.listen(PORT, () => console.log(`FLITO backend running on port ${PORT}`));
};

bootstrap();
