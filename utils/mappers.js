/**
 * Convert database rows (snake_case) into the camelCase JSON contract.
 * Mappers are the only place that decides which columns leave the server,
 * so password_hash and other internal columns can never leak into a response.
 */
const { decrypt } = require('./crypto');

const iso = (d) => (d ? new Date(d).toISOString() : null);

function toUnit(row) {
  if (!row) return null;
  return { id: row.id, unitNumber: row.unit_number, floor: row.floor ?? null };
}

function toUserProfile(row) {
  return {
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    email: row.email,
    unit: row.unit_id ? { id: row.unit_id, unitNumber: row.unit_number, floor: row.unit_floor ?? null } : null,
  };
}

function toResident(row) {
  return {
    ...toUserProfile(row),
    openRequests: row.open_requests !== undefined ? Number(row.open_requests) : undefined,
    createdAt: iso(row.created_at),
    lastLoginAt: iso(row.last_login_at),
  };
}

function toTechnician(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone_encrypted ? decrypt(row.phone_encrypted) : null,
    specialty: row.specialty,
    isActive: Boolean(row.is_active),
  };
}

function toRequest(row) {
  return {
    id: row.id,
    unit: { id: row.unit_id, unitNumber: row.unit_number },
    resident: {
      id: row.resident_id,
      fullName: row.resident_deleted_at ? 'Former resident' : row.resident_name,
      isFormer: Boolean(row.resident_deleted_at),
    },
    technician: row.technician_id
      ? { id: row.technician_id, fullName: row.technician_name, specialty: row.technician_specialty }
      : null,
    category: row.category,
    description: row.description,
    priority: row.priority,
    status: row.status,
    createdAt: iso(row.created_at),
    updatedAt: iso(row.updated_at),
    closedAt: iso(row.closed_at),
  };
}

function toActivity(row) {
  return {
    id: Number(row.id),
    action: row.action,
    actor: { id: row.actor_id, fullName: row.actor_name },
    oldValue: row.old_value,
    newValue: row.new_value,
    note: row.note,
    createdAt: iso(row.created_at),
  };
}

function toNotification(row) {
  return {
    id: Number(row.id),
    requestId: row.request_id,
    statusAfter: row.status_after,
    message: row.message,
    note: row.note,
    isRead: Boolean(row.is_read),
    createdAt: iso(row.created_at),
    readAt: iso(row.read_at),
  };
}

function toAuthEvent(row) {
  return {
    id: Number(row.id),
    eventType: row.event_type,
    userId: row.user_id,
    email: row.email_attempted,
    reason: row.reason,
    ip: row.ip_address,
    userAgent: row.user_agent,
    method: row.http_method,
    path: row.path,
    createdAt: iso(row.created_at),
  };
}

function pageInfo(page, pageSize, totalItems) {
  return { page, pageSize, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / pageSize)) };
}

module.exports = {
  iso, toUnit, toUserProfile, toResident, toTechnician, toRequest,
  toActivity, toNotification, toAuthEvent, pageInfo,
};
