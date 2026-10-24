const prisma = require('../../config/database');
const { ApiError } = require('../../utils/apiResponse');

const create = async ({ firstName, lastName, email, phone, subject, message }) => {
  if (!firstName || !lastName || !email || !subject || !message) {
    throw new ApiError(400, 'Nom, prénom, email, sujet et message sont obligatoires.');
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) throw new ApiError(400, 'Adresse email invalide.');
  if (String(message).trim().length < 10) throw new ApiError(400, 'Le message doit contenir au moins 10 caractères.');
  return prisma.contactMessage.create({
    data: {
      firstName: String(firstName).trim(),
      lastName: String(lastName).trim(),
      email: String(email).trim().toLowerCase(),
      phone: phone ? String(phone).trim() : null,
      subject: String(subject).trim(),
      message: String(message).trim(),
    },
  });
};

const getAll = async (query = {}) => {
  const page = parseInt(query.page) || 1;
  const limit = parseInt(query.limit) || 20;
  const skip = (page - 1) * limit;
  const where = {};
  if (query.isRead === 'true') where.isRead = true;
  if (query.isRead === 'false') where.isRead = false;
  if (query.search) {
    const s = String(query.search).trim();
    where.OR = [
      { firstName: { contains: s, mode: 'insensitive' } },
      { lastName: { contains: s, mode: 'insensitive' } },
      { email: { contains: s, mode: 'insensitive' } },
      { subject: { contains: s, mode: 'insensitive' } },
    ];
  }
  const [data, total] = await Promise.all([
    prisma.contactMessage.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      include: { readBy: { select: { id: true, firstName: true, lastName: true } } },
    }),
    prisma.contactMessage.count({ where }),
  ]);
  return { data, meta: { page, limit, total, pages: Math.ceil(total / limit) } };
};

const getOne = async (id, userId) => {
  let msg = await prisma.contactMessage.findUnique({
    where: { id },
    include: { readBy: { select: { id: true, firstName: true, lastName: true } } },
  });
  if (!msg) throw new ApiError(404, 'Message introuvable.');
  if (!msg.isRead) {
    msg = await prisma.contactMessage.update({
      where: { id },
      data: { isRead: true, readAt: new Date(), readById: userId },
      include: { readBy: { select: { id: true, firstName: true, lastTag: true } } },
    });
    // correction mineure au cas où lastTag n'existe pas
    if (!msg.readBy) {
      msg = await prisma.contactMessage.findUnique({ where: { id }, include: { readBy: { select: { id: true, firstName: true, lastName: true } } } });
    }
  }
  return msg;
};

const markRead = async (id, userId) => {
  return prisma.contactMessage.update({
    where: { id },
    data: { isRead: true, readAt: new Date(), readById: userId },
    include: { readBy: { select: { id: true, firstName: true, lastName: true } } },
  });
};

const markUnread = async (id) => {
  return prisma.contactMessage.update({
    where: { id },
    data: { isRead: false, readAt: null, readById: null },
    include: { readBy: { select: { id: true, firstName: true, lastName: true } } },
  });
};

const remove = async (id) => {
  const m = await prisma.contactMessage.findUnique({ where: { id } });
  if (!m) throw new ApiError(404, 'Message introuvable.');
  await prisma.contactMessage.delete({ where: { id } });
  return true;
};

const countUnread = async () => prisma.contactMessage.count({ where: { isRead: false } });

module.exports = { create, getAll, getOne, markRead, markUnread, remove, countUnread };
