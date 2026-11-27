/**
 * Password hashing with Argon2id (OWASP Password Storage Cheat Sheet settings:
 * m = 19 MiB, t = 2, p = 1). Argon2 adds a random 16-byte salt per password and
 * stores the algorithm, parameters and salt inside the hash string, e.g.
 * $argon2id$v=19$m=19456,t=2,p=1$<salt>$<hash>
 */
const argon2 = require('argon2');

const HASH_OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 19456, // KiB
  timeCost: 2,
  parallelism: 1,
};

/** @param {string} plain */
function hashPassword(plain) {
  return argon2.hash(plain, HASH_OPTIONS);
}

/**
 * Constant-time comparison is done inside argon2.verify.
 * Returns false (never throws) for malformed hashes.
 */
async function verifyPassword(hash, plain) {
  try {
    return await argon2.verify(hash, plain);
  } catch {
    return false;
  }
}

/** True when the stored hash was made with older/weaker parameters. */
function needsRehash(hash) {
  return argon2.needsRehash(hash, HASH_OPTIONS);
}

// A real Argon2id hash of a random value. Used when the email does not exist so
// a failed login takes the same time either way (prevents account enumeration
// through response timing).
let dummyHashPromise = null;
function getDummyHash() {
  if (!dummyHashPromise) {
    dummyHashPromise = hashPassword(require('crypto').randomBytes(32).toString('hex'));
  }
  return dummyHashPromise;
}

module.exports = { hashPassword, verifyPassword, needsRehash, getDummyHash };
