/**
 * Express application (no network listener - see server.js).
 * Global middleware order matters:
 *   security headers -> CORS -> JSON body (size-limited) -> CSRF guard
 *   -> session -> general rate limit -> /api routes -> 404 -> error handler
 */
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const config = require('./config/env');
const { sessionMiddleware } = require('./config/session');
const { apiLimiter, csrfGuard } = require('./middlewares/security');
const { notFound, errorHandler } = require('./middlewares/errorHandler');
const apiRoutes = require('./routes');

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', config.trustProxy); // correct client IP for logs and rate limits behind a proxy

// Security headers: CSP, HSTS, X-Content-Type-Options, frame-ancestors, Referrer-Policy ...
app.use(helmet());

// Only our own frontend origins may call the API with credentials (cookies).
app.use(cors({
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type'],
}));

app.use(express.json({ limit: '20kb', strict: true }));
app.use(csrfGuard);
app.use(sessionMiddleware);

// API responses contain personal data: never cache them.
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));
app.use('/api', apiLimiter, apiRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
