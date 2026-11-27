/**
 * HTTP layer for /api/notifications (resident's own notifications only).
 */
const AppError = require('../utils/AppError');
const requestRepository = require('../repositories/requestRepository');
const { toNotification, pageInfo } = require('../utils/mappers');

/** GET /api/notifications?unread=true&page=1 */
async function list(req, res) {
  const page = req.valid.query.page || 1;
  const pageSize = req.valid.query.pageSize || 20;
  const { rows, total, unreadCount } = await requestRepository.listNotifications(
    req.user.id, req.valid.query, pageSize, (page - 1) * pageSize,
  );
  res.json({ items: rows.map(toNotification), unreadCount, pagination: pageInfo(page, pageSize, total) });
}

/** PATCH /api/notifications/:id/read - 404 if it is not the caller's notification */
async function markRead(req, res) {
  const row = await requestRepository.markNotificationRead(req.valid.params.id, req.user.id);
  if (!row) throw AppError.notFound('Notification');
  res.json(toNotification(row));
}

/** POST /api/notifications/read-all */
async function markAllRead(req, res) {
  const updated = await requestRepository.markAllNotificationsRead(req.user.id);
  res.json({ updated });
}

module.exports = { list, markRead, markAllRead };
