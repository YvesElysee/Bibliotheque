const { badRequest } = require('../utils/apiResponse');

/**
 * Valide le body de la requête avec un schéma Zod.
 * @param {import('zod').ZodSchema} schema
 */
const validateBody = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.body);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return badRequest(res, 'Données invalides.', errors);
  }
  req.body = result.data;
  next();
};

/**
 * Valide les query params de la requête avec un schéma Zod.
 * @param {import('zod').ZodSchema} schema
 */
const validateQuery = (schema) => (req, res, next) => {
  const result = schema.safeParse(req.query);
  if (!result.success) {
    const errors = result.error.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return badRequest(res, 'Paramètres de requête invalides.', errors);
  }
  req.query = result.data;
  next();
};

module.exports = { validateBody, validateQuery };
