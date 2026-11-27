/**
 * Maintenance request business logic.
 *
 * Use case 1 - Create maintenance request (resident): createRequest()
 * Use case 2 - Update request status (admin):        updateStatus()
 * plus the supporting operations (list, view, edit, cancel, assign technician,
 * activity log).
 *
 * The status rules live here, in one place, so every endpoint enforces the same
 * workflow. Each change writes its activity row in the same SQL transaction, so
 * the request and its history can never disagree.
 */
const { withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const requestRepository = require('../repositories/requestRepository');
const buildingRepository = require('../repositories/buildingRepository');
const { toRequest, toActivity, toNotification, pageInfo } = require('../utils/mappers');
const { notifyUser } = require('./notifier');

/** Allowed admin transitions. done and cancelled are final. */
const ADMIN_TRANSITIONS = {
  open: ['in_progress'],
  in_progress: ['done'],
  done: [],
  cancelled: [],
};

const STATUS_LABEL = { open: 'Open', in_progress: 'In Progress', done: 'Done', cancelled: 'Cancelled' };

/**
 * Loads a request the user may see. Residents get 404 (not 403) for other
 * residents' requests so they cannot discover which ids exist.
 */
async function getVisibleRequest(user, id) {
  const row = await requestRepository.findById(id);
  if (!row || (user.role === 'resident' && row.resident_id !== user.id)) {
    throw AppError.notFound('Request');
  }
  return row;
}

// ---------------------------------------------------------------------------
// USE CASE 1: Create maintenance request
// ---------------------------------------------------------------------------
/**
 * Resident and unit come from the session, never from the request body.
 * @param {{id:number, unitId:number|null}} user
 * @param {{category:string, description:string, priority?:string}} input
 */
async function createRequest(user, input) {
  // Extension: resident has no unit yet -> cannot report a problem.
  if (!user.unitId) {
    throw AppError.conflict('NO_UNIT_ASSIGNED',
      'Your account is not linked to a unit yet. Please contact the building manager.');
  }
  const unit = await buildingRepository.findActiveUnit(user.unitId);
  if (!unit) {
    throw AppError.conflict('NO_UNIT_ASSIGNED', 'Your unit is no longer active. Please contact the building manager.');
  }

  const id = await withTransaction(async (conn) => {
    const requestId = await requestRepository.insertRequest(conn, {
      unitId: unit.id,
      residentId: user.id,
      category: input.category,
      description: input.description,
      priority: input.priority || 'medium',
    });
    await requestRepository.insertActivity(conn, { requestId, actorId: user.id, action: 'created', newValue: 'open' });
    return requestId;
  });

  return toRequest(await requestRepository.findById(id));
}

async function listRequests(user, query) {
  const page = query.page || 1;
  const pageSize = query.pageSize || 20;
  const filters = { status: query.status, category: query.category, priority: query.priority };
  if (user.role === 'resident') {
    filters.residentId = user.id; // residents only ever see their own requests
  } else {
    filters.unitId = query.unitId;
    filters.technicianId = query.technicianId;
  }
  const { rows, total } = await requestRepository.list(filters, pageSize, (page - 1) * pageSize);
  return { items: rows.map(toRequest), pagination: pageInfo(page, pageSize, total) };
}

async function getRequest(user, id) {
  return toRequest(await getVisibleRequest(user, id));
}

/** Owner edits category / description / priority while the request is still Open. */
async function editRequest(user, id, changes) {
  if (Object.keys(changes).length === 0) {
    throw AppError.badRequest('Send at least one of category, description or priority.');
  }
  await withTransaction(async (conn) => {
    const current = await requestRepository.findByIdForUpdate(conn, id);
    if (!current || current.resident_id !== user.id) throw AppError.notFound('Request');
    if (current.status !== 'open') {
      throw AppError.conflict('REQUEST_NOT_OPEN', 'Only Open requests can be edited.');
    }
    const next = {
      category: changes.category ?? current.category,
      description: changes.description ?? current.description,
      priority: changes.priority ?? current.priority,
    };
    const changed = Object.keys(next).filter((k) => next[k] !== current[k]);
    if (changed.length === 0) return;
    await requestRepository.updateDetails(conn, id, next);
    await requestRepository.insertActivity(conn, {
      requestId: id, actorId: user.id, action: 'edited', newValue: changed.join(','),
    });
  });
  return toRequest(await requestRepository.findById(id));
}

/** Owner cancels an Open request (Open -> Cancelled is the only resident transition). */
async function cancelRequest(user, id) {
  await withTransaction(async (conn) => {
    const current = await requestRepository.findByIdForUpdate(conn, id);
    if (!current || current.resident_id !== user.id) throw AppError.notFound('Request');
    if (current.status !== 'open') {
      throw AppError.conflict('REQUEST_NOT_OPEN', 'Only Open requests can be cancelled.');
    }
    await requestRepository.updateStatus(conn, id, 'cancelled');
    await requestRepository.insertActivity(conn, {
      requestId: id, actorId: user.id, action: 'cancelled', oldValue: 'open', newValue: 'cancelled',
    });
  });
  return toRequest(await requestRepository.findById(id));
}

// ---------------------------------------------------------------------------
// USE CASE 2: Update request status (admin)
// ---------------------------------------------------------------------------
/**
 * One transaction saves: the new status, a status_changed activity row, an
 * optional note_added row and a notification for the resident. If any insert
 * fails everything is rolled back. Only after COMMIT is the real-time event
 * pushed; an offline resident still finds the unread row at next login.
 */
async function updateStatus(admin, id, { status, note }) {
  const result = await withTransaction(async (conn) => {
    const current = await requestRepository.findByIdForUpdate(conn, id); // row lock
    if (!current) throw AppError.notFound('Request');

    const allowed = ADMIN_TRANSITIONS[current.status] || [];
    if (!allowed.includes(status)) {
      throw AppError.conflict('INVALID_STATUS_TRANSITION',
        `A request cannot move from ${current.status} to ${status}.`);
    }

    await requestRepository.updateStatus(conn, id, status);
    await requestRepository.insertActivity(conn, {
      requestId: id, actorId: admin.id, action: 'status_changed', oldValue: current.status, newValue: status,
    });
    if (note) {
      await requestRepository.insertActivity(conn, { requestId: id, actorId: admin.id, action: 'note_added', note });
    }

    const notification = await requestRepository.insertNotification(conn, {
      userId: current.resident_id,
      requestId: id,
      statusAfter: status,
      message: `Your request #${id} is now ${STATUS_LABEL[status]}.`,
      note,
    });
    return { residentId: current.resident_id, notification };
  });

  notifyUser(result.residentId, 'notification:new', toNotification(result.notification));
  const updated = await requestRepository.findById(id);
  return { id: updated.id, status: updated.status, updatedAt: toRequest(updated).updatedAt };
}

/** Admin assigns, changes or removes (null) the technician of an Open / In Progress request. */
async function assignTechnician(admin, id, technicianId) {
  await withTransaction(async (conn) => {
    const current = await requestRepository.findByIdForUpdate(conn, id);
    if (!current) throw AppError.notFound('Request');
    if (!['open', 'in_progress'].includes(current.status)) {
      throw AppError.conflict('REQUEST_CLOSED', 'Technicians can only be assigned to Open or In Progress requests.');
    }
    if (technicianId !== null) {
      const tech = await buildingRepository.findTechnician(technicianId, conn);
      if (!tech) throw AppError.notFound('Technician');
      if (!tech.is_active) throw AppError.conflict('TECHNICIAN_INACTIVE', 'This technician is deactivated.');
    }
    if (current.technician_id === technicianId) return;
    await requestRepository.setTechnician(conn, id, technicianId);
    // old/new values are technician ids ("technician:3"), null = unassigned
    await requestRepository.insertActivity(conn, {
      requestId: id,
      actorId: admin.id,
      action: 'technician_assigned',
      oldValue: current.technician_id ? `technician:${current.technician_id}` : null,
      newValue: technicianId ? `technician:${technicianId}` : null,
    });
  });
  const updated = toRequest(await requestRepository.findById(id));
  return { id: updated.id, technician: updated.technician };
}

async function getActivity(id) {
  const row = await requestRepository.findById(id);
  if (!row) throw AppError.notFound('Request');
  return { items: (await requestRepository.listActivity(id)).map(toActivity) };
}

module.exports = {
  ADMIN_TRANSITIONS,
  createRequest, listRequests, getRequest, editRequest, cancelRequest,
  updateStatus, assignTechnician, getActivity,
};
