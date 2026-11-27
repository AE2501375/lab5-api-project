/**
 * Entry point: starts HTTP or HTTPS (when TLS_KEY_PATH / TLS_CERT_PATH are set)
 * and attaches Socket.IO for real-time notifications (WebSocket / WSS).
 */
const fs = require('fs');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const config = require('./config/env');
const app = require('./app');
const { db } = require('./config/db');
const { sessionMiddleware } = require('./config/session');
const notifier = require('./services/notifier');

function createServer() {
  if (config.tls.enabled) {
    return https.createServer({
      key: fs.readFileSync(config.tls.keyPath),
      cert: fs.readFileSync(config.tls.certPath),
      minVersion: 'TLSv1.2',
    }, app);
  }
  return http.createServer(app);
}

/**
 * Socket.IO reuses the same session cookie as the REST API, so only a
 * logged-in user can connect, and each socket joins only its own room.
 */
function attachSockets(server) {
  const io = new Server(server, {
    cors: { origin: config.corsOrigins, credentials: true },
  });
  io.engine.use(sessionMiddleware);
  io.use((socket, next) => {
    const userId = socket.request.session && socket.request.session.userId;
    if (!userId) return next(new Error('unauthorized'));
    socket.data.userId = userId;
    return next();
  });
  io.on('connection', (socket) => {
    socket.join(`user:${socket.data.userId}`);
  });
  notifier.attach(io);
  return io;
}

async function start() {
  await db.query('SELECT 1'); // fail fast if the database is unreachable
  const server = createServer();
  attachSockets(server);
  server.listen(config.port, config.host, () => {
    const scheme = config.tls.enabled ? 'https' : 'http';
    console.log(`FixMyUnit API listening on ${scheme}://${config.host}:${config.port}/api`);
    if (!config.session.cookieSecure) {
      console.warn('Session cookie Secure flag is OFF (local HTTP). Use HTTPS / COOKIE_SECURE=true in production.');
    }
  });
}

if (require.main === module) {
  start().catch((err) => {
    console.error('Failed to start:', err.message);
    process.exit(1);
  });
}

module.exports = { createServer, attachSockets };
