/**
 * Validation middleware factory.
 * Usage: router.post('/', validate(schemas.createRequest), controller)
 * The cleaned values are placed on req.valid.body / req.valid.query / req.valid.params.
 */
const AppError = require('../utils/AppError');
const { validateSchema } = require('../utils/validators');

/**
 * @param {object} schema
 * @param {'body'|'query'|'params'} [source]
 */
function validate(schema, source = 'body') {
  return (req, res, next) => {
    const { value, errors } = validateSchema(schema, req[source]);
    if (errors.length > 0) {
      throw AppError.badRequest('Some fields are invalid.', errors);
    }
    req.valid = req.valid || {};
    req.valid[source] = value;
    next();
  };
}

module.exports = validate;
