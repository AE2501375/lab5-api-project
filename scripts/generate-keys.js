/**
 * Prints fresh random secrets for .env (never commit the real .env).
 *   npm run keys
 */
const crypto = require('crypto');
console.log(`SESSION_SECRET=${crypto.randomBytes(48).toString('base64url')}`);
console.log(`DATA_ENCRYPTION_KEY=${crypto.randomBytes(32).toString('hex')}`);
