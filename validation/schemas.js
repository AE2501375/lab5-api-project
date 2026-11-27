/**
 * Whitelist validation schemas for every endpoint that accepts input.
 * Field names follow the camelCase JSON contract from Milestone 3.
 */
const { NAME_RE, CATEGORIES, PRIORITIES, STATUSES } = require('../utils/validators');

const idParam = { id: { type: 'int', required: true, min: 1 } };

const pagination = {
  page: { type: 'int', min: 1, max: 100000 },
  pageSize: { type: 'int', min: 1, max: 100 },
};

module.exports = {
  idParam,

  signup: {
    fullName: { type: 'string', required: true, min: 2, max: 100, pattern: NAME_RE, patternMessage: 'Use letters, spaces, apostrophes, dots or hyphens only.' },
    email: { type: 'email', required: true, max: 255 },
    password: { type: 'password', required: true },
  },

  login: {
    email: { type: 'email', required: true, max: 255 },
    password: { type: 'password', required: true },
  },

  createRequest: {
    category: { type: 'string', required: true, enum: CATEGORIES },
    description: { type: 'string', required: true, min: 10, max: 2000 },
    priority: { type: 'string', enum: PRIORITIES },
  },

  editRequest: {
    category: { type: 'string', enum: CATEGORIES },
    description: { type: 'string', min: 10, max: 2000 },
    priority: { type: 'string', enum: PRIORITIES },
  },

  listRequests: {
    ...pagination,
    status: { type: 'string', enum: STATUSES },
    category: { type: 'string', enum: CATEGORIES },
    priority: { type: 'string', enum: PRIORITIES },
    unitId: { type: 'int', min: 1 },
    technicianId: { type: 'int', min: 1 },
  },

  updateStatus: {
    status: { type: 'string', required: true, enum: STATUSES },
    note: { type: 'string', min: 1, max: 500 },
  },

  assignTechnician: {
    technicianId: { type: 'int', required: true, min: 1, nullable: true },
  },

  listNotifications: {
    ...pagination,
    unread: { type: 'boolean' },
  },

  createUnit: {
    unitNumber: { type: 'string', required: true, min: 1, max: 20, pattern: /^[A-Za-z0-9-]+$/, patternMessage: 'Use letters, digits and hyphens only, e.g. B-204.' },
    floor: { type: 'int', min: -5, max: 200, nullable: true },
  },

  listResidents: {
    ...pagination,
    unitId: { type: 'int', min: 1 },
    unassigned: { type: 'boolean' },
    search: { type: 'string', min: 1, max: 100 },
  },

  assignUnit: {
    unitId: { type: 'int', required: true, min: 1, nullable: true },
  },

  createTechnician: {
    fullName: { type: 'string', required: true, min: 2, max: 100, pattern: NAME_RE, patternMessage: 'Use letters, spaces, apostrophes, dots or hyphens only.' },
    phone: { type: 'string', min: 6, max: 30, pattern: /^\+?[0-9 ()-]{6,30}$/, patternMessage: 'Must be a phone number, e.g. +20 100 123 4567.' },
    specialty: { type: 'string', enum: CATEGORIES },
  },

  listAuthEvents: {
    ...pagination,
    eventType: { type: 'string', enum: ['signup', 'login_success', 'login_failure', 'login_locked', 'logout', 'session_expired', 'access_denied', 'rate_limited'] },
    userId: { type: 'int', min: 1 },
    ip: { type: 'string', max: 45 },
  },
};
