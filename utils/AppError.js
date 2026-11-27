/**
 * An expected, client-facing error. The error handler turns it into the
 * standard envelope: { "error": { "code", "message", "details" } }.
 */
class AppError extends Error {
  /**
   * @param {number} status   HTTP status code
   * @param {string} code     machine-readable code, e.g. VALIDATION_ERROR
   * @param {string} message  safe, human-readable message
   * @param {Array<{field:string,message:string}>} [details]
   */
  constructor(status, code, message, details = []) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }

  static badRequest(message, details) { return new AppError(400, 'VALIDATION_ERROR', message, details); }
  static unauthenticated(message = 'Please log in to continue.') { return new AppError(401, 'UNAUTHENTICATED', message); }
  static forbidden(message = 'You do not have permission to do this.') { return new AppError(403, 'FORBIDDEN', message); }
  static notFound(what = 'Resource') { return new AppError(404, 'NOT_FOUND', `${what} not found.`); }
  static conflict(code, message) { return new AppError(409, code, message); }
}

module.exports = AppError;
