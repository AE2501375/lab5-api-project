/**
 * HTTP layer for admin-only building management and the security log:
 * /api/units, /api/residents, /api/technicians, /api/admin/auth-events
 */
const AppError = require('../utils/AppError');
const userRepository = require('../repositories/userRepository');
const buildingRepository = require('../repositories/buildingRepository');
const authEventRepository = require('../repositories/authEventRepository');
const { encrypt } = require('../utils/crypto');
const { toUnit, toResident, toTechnician, toAuthEvent, pageInfo } = require('../utils/mappers');

// ----- units -----
async function listUnits(req, res) {
  res.json({ items: (await buildingRepository.listUnits()).map(toUnit) });
}

async function createUnit(req, res) {
  try {
    const id = await buildingRepository.createUnit(req.valid.body);
    res.status(201).json(toUnit(await buildingRepository.findActiveUnit(id)));
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') throw AppError.conflict('UNIT_NUMBER_TAKEN', 'This unit number is already used.');
    throw err;
  }
}

// ----- residents -----
async function listResidents(req, res) {
  const page = req.valid.query.page || 1;
  const pageSize = req.valid.query.pageSize || 20;
  const { rows, total } = await userRepository.listResidents(req.valid.query, pageSize, (page - 1) * pageSize);
  res.json({ items: rows.map(toResident), pagination: pageInfo(page, pageSize, total) });
}

/** PUT /api/residents/:id/unit  { "unitId": 7 } or { "unitId": null } */
async function assignUnit(req, res) {
  const { id } = req.valid.params;
  const { unitId } = req.valid.body;
  const resident = await userRepository.findActiveResidentById(id);
  if (!resident) throw AppError.notFound('Resident');
  if (unitId !== null && !(await buildingRepository.findActiveUnit(unitId))) throw AppError.notFound('Unit');
  await userRepository.setUnit(id, unitId);
  res.json(toResident(await userRepository.findActiveResidentById(id)));
}

// ----- technicians (phone stored encrypted, returned decrypted to the admin only) -----
async function listTechnicians(req, res) {
  res.json({ items: (await buildingRepository.listTechnicians()).map(toTechnician) });
}

async function createTechnician(req, res) {
  const { fullName, phone, specialty } = req.valid.body;
  const id = await buildingRepository.createTechnician({ fullName, phoneEncrypted: encrypt(phone), specialty });
  res.status(201).json(toTechnician(await buildingRepository.findTechnician(id)));
}

// ----- security log -----
async function listAuthEvents(req, res) {
  const page = req.valid.query.page || 1;
  const pageSize = req.valid.query.pageSize || 50;
  const { rows, total } = await authEventRepository.list(req.valid.query, pageSize, (page - 1) * pageSize);
  res.json({ items: rows.map(toAuthEvent), pagination: pageInfo(page, pageSize, total) });
}

module.exports = {
  listUnits, createUnit, listResidents, assignUnit, listTechnicians, createTechnician, listAuthEvents,
};
