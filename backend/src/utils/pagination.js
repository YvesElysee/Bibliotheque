/**
 * Génère les paramètres de pagination Prisma et les métadonnées de réponse.
 * @param {Object} query - Query params (page, limit)
 * @param {number} total - Nombre total d'éléments
 * @returns {{ skip, take, meta }}
 */
const getPagination = (query, total) => {
  const page = Math.max(1, parseInt(query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit) || 20));
  const skip = (page - 1) * limit;
  const totalPages = Math.ceil(total / limit);

  return {
    skip,
    take: limit,
    meta: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
};

module.exports = { getPagination };
