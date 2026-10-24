function validateTrip(req, res, next) {
  const body = req.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return res.status(400).json({ status: 'fail', message: 'Provide a JSON object' });
  }

  const isUpdate = req.method === 'PUT';
  const fields = {};
  for (const field of ['destination', 'country']) {
    if (!isUpdate || Object.hasOwn(body, field)) {
      if (typeof body[field] !== 'string' || body[field].trim() === '') {
        return res.status(400).json({
          status: 'fail', message: `Provide a non-empty ${field}`
        });
      }
      fields[field] = body[field].trim();
    }
  }

  if (!isUpdate || Object.hasOwn(body, 'cost')) {
    if (typeof body.cost !== 'number' || !Number.isFinite(body.cost) || body.cost <= 0) {
      return res.status(400).json({
        status: 'fail', message: 'Cost must be a finite number greater than zero'
      });
    }
    fields.cost = body.cost;
  }

  if (Object.hasOwn(body, 'description')) {
    if (typeof body.description !== 'string') {
      return res.status(400).json({ status: 'fail', message: 'Description must be a string' });
    }
    fields.description = body.description.trim() || 'No description available';
  }

  if (Object.keys(fields).length === 0) {
    return res.status(400).json({ status: 'fail', message: 'Provide at least one trip field to update' });
  }

  req.tripData = fields;
  return next();
}

module.exports = validateTrip;
