/**
 * Field-level encryption for personal data at rest (AES-256-GCM).
 *
 * GCM is authenticated encryption: a tampered ciphertext fails to decrypt
 * instead of returning garbage. A new random 12-byte IV is used for every value.
 * Stored format:  v1:<iv base64>:<auth tag base64>:<ciphertext base64>
 *
 * The 32-byte key lives only in the environment (DATA_ENCRYPTION_KEY), never in
 * the database, so a leaked database dump does not reveal the encrypted fields.
 */
const crypto = require('crypto');
const config = require('../config/env');

const ALGORITHM = 'aes-256-gcm';
const VERSION = 'v1';

/** @param {string|null|undefined} plaintext */
function encrypt(plaintext) {
  if (plaintext === null || plaintext === undefined || plaintext === '') return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, config.encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString('base64'), tag.toString('base64'), ciphertext.toString('base64')].join(':');
}

/** @param {string|null} payload */
function decrypt(payload) {
  if (!payload) return null;
  const [version, ivB64, tagB64, dataB64] = payload.split(':');
  if (version !== VERSION || !ivB64 || !tagB64 || dataB64 === undefined) {
    throw new Error('Unsupported encrypted value format');
  }
  const decipher = crypto.createDecipheriv(ALGORITHM, config.encryptionKey, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(dataB64, 'base64')), decipher.final()]).toString('utf8');
}

module.exports = { encrypt, decrypt };
