/**
 * All /api routes. Each route lists its middleware chain in order:
 *   rate limit -> requireAuth (401) -> requireRole (403) -> validate (400) -> controller
 */
const express = require('express');
const validate = require('../middlewares/validate');
const { requireAuth, requireRole } = require('../middlewares/auth');
const { loginLimiter, signupLimiter } = require('../middlewares/security');
const schemas = require('../validation/schemas');
const auth = require('../controllers/authController');
const requests = require('../controllers/requestController');
const notifications = require('../controllers/notificationController');
const admin = require('../controllers/adminController');

const router = express.Router();
const id = validate(schemas.idParam, 'params');
const resident = [requireAuth, requireRole('resident')];
const adminOnly = [requireAuth, requireRole('admin')];
const anyUser = [requireAuth, requireRole('resident', 'admin')];

// ---------- Authentication (public) ----------
router.post('/auth/signup', signupLimiter, validate(schemas.signup), auth.signup);
router.post('/auth/login', loginLimiter, validate(schemas.login), auth.login);
router.post('/auth/logout', requireAuth, auth.logout);

// ---------- Profile ----------
router.get('/users/me', requireAuth, auth.me);

// ---------- Maintenance requests (UC-1, UC-2) ----------
router.post('/requests', ...resident, validate(schemas.createRequest), requests.create);
router.get('/requests', ...anyUser, validate(schemas.listRequests, 'query'), requests.list);
router.get('/requests/:id', ...anyUser, id, requests.getOne);
router.patch('/requests/:id', ...resident, id, validate(schemas.editRequest), requests.edit);
router.post('/requests/:id/cancel', ...resident, id, requests.cancel);
router.patch('/requests/:id/status', ...adminOnly, id, validate(schemas.updateStatus), requests.updateStatus);
router.put('/requests/:id/technician', ...adminOnly, id, validate(schemas.assignTechnician), requests.assignTechnician);
router.get('/requests/:id/activity', ...adminOnly, id, requests.activity);

// ---------- Notifications (resident) ----------
router.get('/notifications', ...resident, validate(schemas.listNotifications, 'query'), notifications.list);
router.post('/notifications/read-all', ...resident, notifications.markAllRead);
router.patch('/notifications/:id/read', ...resident, id, notifications.markRead);

// ---------- Building management (admin) ----------
router.get('/units', ...adminOnly, admin.listUnits);
router.post('/units', ...adminOnly, validate(schemas.createUnit), admin.createUnit);
router.get('/residents', ...adminOnly, validate(schemas.listResidents, 'query'), admin.listResidents);
router.put('/residents/:id/unit', ...adminOnly, id, validate(schemas.assignUnit), admin.assignUnit);
router.get('/technicians', ...adminOnly, admin.listTechnicians);
router.post('/technicians', ...adminOnly, validate(schemas.createTechnician), admin.createTechnician);

// ---------- Security log (admin) ----------
router.get('/admin/auth-events', ...adminOnly, validate(schemas.listAuthEvents, 'query'), admin.listAuthEvents);

module.exports = router;
