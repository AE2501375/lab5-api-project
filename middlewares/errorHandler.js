/**
 * Last middleware: converts every error into the standard JSON envelope.
 * Unexpected errors return a generic 500 message - stack traces, SQL and
 * library messages are logged on the server but never sent to the client.
 */
const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  next(new AppError(404, 'NOT_FOUND', 'Endpoint not found.'));
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  let error = err;

  if (!(err instanceof AppError)) {
    if (err.type === 'entity.parse.failed') error = new AppError(400, 'INVALID_JSON', 'Request body is not valid JSON.');
    else if (err.type === 'entity.too.large') error = new AppError(413, 'PAYLOAD_TOO_LARGE', 'Request body is too large.');
    else if (err.code === 'ER_DUP_ENTRY') error = new AppError(409, 'DUPLICATE', 'This value is already in use.');
    else if (err.code === 'ER_CHECK_CONSTRAINT_VIOLATED') error = AppError.badRequest('The data breaks a database rule.');
    else {
      console.error(JSON.stringify({
        ts: new Date().toISOString(), type: 'server_error', method: req.method,
        path: req.originalUrl.split('?')[0], message: err.message, stack: err.stack,
      }));
      error = new AppError(500, 'INTERNAL_ERROR', 'Something went wrong. Please try again later.');
    }
  }

  res.status(error.status).json({
    error: { code: error.code, message: error.message, details: error.details || [] },
  });
}

module.exports = { notFound, errorHandler };
