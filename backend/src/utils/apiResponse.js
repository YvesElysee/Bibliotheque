/**
 * Format de réponse API uniforme.
 */

const success = (res, data = null, message = 'Succès', statusCode = 200) => {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

const created = (res, data = null, message = 'Ressource créée') => {
  return success(res, data, message, 201);
};

const error = (res, message = 'Une erreur est survenue', statusCode = 500, errors = null) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

const notFound = (res, message = 'Ressource introuvable') => {
  return error(res, message, 404);
};

const unauthorized = (res, message = 'Non authentifié') => {
  return error(res, message, 401);
};

const forbidden = (res, message = 'Accès refusé') => {
  return error(res, message, 403);
};

const badRequest = (res, message = 'Requête invalide', errors = null) => {
  return error(res, message, 400, errors);
};

const paginated = (res, data, meta) => {
  return res.status(200).json({
    success: true,
    data,
    meta,
  });
};

module.exports = { success, created, error, notFound, unauthorized, forbidden, badRequest, paginated };
