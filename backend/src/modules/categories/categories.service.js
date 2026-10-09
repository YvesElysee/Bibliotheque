const prisma = require('../../config/database');

const getAll = async () => {
  return prisma.category.findMany({
    orderBy: { nameFr: 'asc' },
    include: { _count: { select: { books: true } } },
  });
};

const create = async ({ nameEn, nameFr, slug, description, color, icon }) => {
  return prisma.category.create({ data: { nameEn, nameFr, slug, description, color, icon } });
};

const update = async (id, data) => {
  const exists = await prisma.category.findUnique({ where: { id } });
  if (!exists) { const err = new Error('Catégorie introuvable.'); err.statusCode = 404; throw err; }
  return prisma.category.update({ where: { id }, data });
};

const remove = async (id) => {
  const exists = await prisma.category.findUnique({ where: { id } });
  if (!exists) { const err = new Error('Catégorie introuvable.'); err.statusCode = 404; throw err; }
  return prisma.category.delete({ where: { id } });
};

module.exports = { getAll, create, update, remove };
