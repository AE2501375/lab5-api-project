/**
 * HTTP layer for /api/requests (use cases 1 and 2 and their supporting endpoints).
 */
const requestService = require('../services/requestService');

/** UC-1  POST /api/requests (resident) */
async function create(req, res) {
  const created = await requestService.createRequest(req.user, req.valid.body);
  res.status(201).location(`/api/requests/${created.id}`).json(created);
}

/** GET /api/requests (resident: own, admin: all + filters) */
async function list(req, res) {
  res.json(await requestService.listRequests(req.user, req.valid.query));
}

/** GET /api/requests/:id (owner or admin) */
async function getOne(req, res) {
  res.json(await requestService.getRequest(req.user, req.valid.params.id));
}

/** PATCH /api/requests/:id (owner, Open only) */
async function edit(req, res) {
  res.json(await requestService.editRequest(req.user, req.valid.params.id, req.valid.body));
}

/** POST /api/requests/:id/cancel (owner, Open only) */
async function cancel(req, res) {
  res.json(await requestService.cancelRequest(req.user, req.valid.params.id));
}

/** UC-2  PATCH /api/requests/:id/status (admin) */
async function updateStatus(req, res) {
  res.json(await requestService.updateStatus(req.user, req.valid.params.id, req.valid.body));
}

/** PUT /api/requests/:id/technician (admin) */
async function assignTechnician(req, res) {
  res.json(await requestService.assignTechnician(req.user, req.valid.params.id, req.valid.body.technicianId));
}

/** GET /api/requests/:id/activity (admin) */
async function activity(req, res) {
  res.json(await requestService.getActivity(req.valid.params.id));
}

module.exports = { create, list, getOne, edit, cancel, updateStatus, assignTechnician, activity };
