const prisma = require('../../config/database');
const { getPagination } = require('../../utils/pagination');

const createRequest = async (userId, { title, author, publisher, description }) => {
  return prisma.bookRequest.create({
    data: { userId, title, author, publisher, description },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
};

const getAllRequests = async (query) => {
  const { status } = query;
  const where = {};
  if (status) where.status = status;

  const { skip, take, meta } = getPagination(query, await prisma.bookRequest.count({ where }));
  const requests = await prisma.bookRequest.findMany({
    where, skip, take,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  return { requests, meta };
};

const updateRequest = async (id, { status, adminNotes }) => {
  const existing = await prisma.bookRequest.findUnique({ where: { id } });
  if (!existing) { const err = new Error('Demande introuvable.'); err.statusCode = 404; throw err; }

  return prisma.bookRequest.update({
    where: { id },
    data: { status, adminNotes },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
};

const getMyRequests = async (userId, query) => {
  const where = { userId };
  const { skip, take, meta } = getPagination(query, await prisma.bookRequest.count({ where }));
  const requests = await prisma.bookRequest.findMany({
    where, skip, take,
    orderBy: { createdAt: 'desc' },
  });
  return { requests, meta };
};

module.exports = { createRequest, getAllRequests, updateRequest, getMyRequests };
