/**
 * Server-side input validation.
 *
 * The client is never trusted: every body / query / route parameter is checked
 * against a whitelist schema. Only fields declared in the schema are copied to
 * the validated object, so server-controlled fields (role, status, residentId,
 * unitId ...) sent by a client are silently ignored (prevents mass assignment).
 *
 * Validation is a second layer only - SQL injection is prevented by the
 * parameterised queries in the repositories.
 */

const EMAIL_RE = /^[^\s@<>()[\],;:"]{1,64}@[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]{0,61}[A-Za-z0-9])?)+$/;
const NAME_RE = /^[\p{L}][\p{L}\p{M} .'-]*$/u;
// Control characters (except tab/newline) are never valid in free text.
const CONTROL_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

const COMMON_PASSWORDS = new Set([
  'password', 'password1', 'password123', '123456789012', 'qwertyuiop12', 'iloveyou1234',
  'administrator', 'letmein12345', 'welcome12345', 'fixmyunit123', 'changeme1234',
]);

/**
 * Password policy (NIST SP 800-63B style): length matters more than symbols.
 * 12-128 characters, at least one letter and one digit, not a common password,
 * must not contain the user's email name.
 * @returns {string|null} error message or null when acceptable
 */
function validatePasswordStrength(password, email = '') {
  if (typeof password !== 'string' || password.length === 0) return 'Password is required.';
  if (password.length < 12) return 'Password must be at least 12 characters.';
  if (password.length > 128) return 'Password must be at most 128 characters.';
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) return 'Password must contain at least one letter and one number.';
  if (COMMON_PASSWORDS.has(password.toLowerCase())) return 'This password is too common.';
  const local = String(email).split('@')[0].toLowerCase();
  if (local.length >= 4 && password.toLowerCase().includes(local)) return 'Password must not contain your email name.';
  return null;
}

/**
 * Validates `input` against `schema`.
 * Supported rule keys: type ('string'|'email'|'password'|'int'|'boolean'),
 * required, nullable, min, max, enum, pattern, patternMessage, lowercase.
 * @returns {{ value: object, errors: Array<{field:string,message:string}> }}
 */
function validateSchema(schema, input) {
  const errors = [];
  const value = {};
  const data = input && typeof input === 'object' && !Array.isArray(input) ? input : {};

  for (const [field, rule] of Object.entries(schema)) {
    let v = data[field];
    const missing = v === undefined || v === '' || (typeof v === 'string' && v.trim() === '' && rule.type !== 'password');

    if (missing) {
      if (rule.required) errors.push({ field, message: 'This field is required.' });
      continue;
    }
    if (v === null) {
      if (rule.nullable) value[field] = null;
      else errors.push({ field, message: 'This field cannot be null.' });
      continue;
    }

    switch (rule.type) {
      case 'string':
      case 'email': {
        if (typeof v !== 'string') { errors.push({ field, message: 'Must be text.' }); continue; }
        v = v.trim().normalize('NFC');
        if (rule.type === 'email' || rule.lowercase) v = v.toLowerCase();
        if (CONTROL_RE.test(v)) { errors.push({ field, message: 'Contains invalid characters.' }); continue; }
        const min = rule.min ?? (rule.type === 'email' ? 3 : 1);
        const max = rule.max ?? 255;
        if (v.length < min || v.length > max) {
          errors.push({ field, message: `Must be ${min} to ${max} characters.` });
          continue;
        }
        if (rule.type === 'email' && !EMAIL_RE.test(v)) { errors.push({ field, message: 'Must be a valid email address.' }); continue; }
        if (rule.enum && !rule.enum.includes(v)) { errors.push({ field, message: `Must be one of: ${rule.enum.join(', ')}.` }); continue; }
        if (rule.pattern && !rule.pattern.test(v)) { errors.push({ field, message: rule.patternMessage || 'Has an invalid format.' }); continue; }
        value[field] = v;
        break;
      }
      case 'password': {
        // Passwords are never trimmed or lower-cased.
        if (typeof v !== 'string') { errors.push({ field, message: 'Must be text.' }); continue; }
        if (v.length > 128) { errors.push({ field, message: 'Must be at most 128 characters.' }); continue; }
        value[field] = v;
        break;
      }
      case 'int': {
        const n = typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : v;
        if (!Number.isSafeInteger(n)) { errors.push({ field, message: 'Must be a whole number.' }); continue; }
        if ((rule.min !== undefined && n < rule.min) || (rule.max !== undefined && n > rule.max)) {
          errors.push({ field, message: `Must be between ${rule.min ?? '-inf'} and ${rule.max ?? 'inf'}.` });
          continue;
        }
        value[field] = n;
        break;
      }
      case 'boolean': {
        if (v === true || v === 'true') value[field] = true;
        else if (v === false || v === 'false') value[field] = false;
        else errors.push({ field, message: 'Must be true or false.' });
        break;
      }
      default:
        throw new Error(`Unknown rule type ${rule.type} for ${field}`);
    }
  }
  return { value, errors };
}

const CATEGORIES = ['plumbing', 'electricity', 'appliances', 'heating_cooling', 'other'];
const PRIORITIES = ['low', 'medium', 'high'];
const STATUSES = ['open', 'in_progress', 'done', 'cancelled'];

module.exports = {
  validatePasswordStrength,
  validateSchema,
  NAME_RE,
  CATEGORIES,
  PRIORITIES,
  STATUSES,
};
