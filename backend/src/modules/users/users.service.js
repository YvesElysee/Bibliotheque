const prisma = require('../../config/database');
const bcrypt = require('bcryptjs');
const { getPagination } = require('../../utils/pagination');

const getAll = async (query) => {
  const { search, role, isActive } = query;
  const where = {};
  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: 'insensitive' } },
      { lastName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (role) where.role = role;
  if (isActive !== undefined) where.isActive = isActive === 'true';

  const { skip, take, meta } = getPagination(query, await prisma.user.count({ where }));
  const users = await prisma.user.findMany({
    where, skip, take,
    orderBy: { createdAt: 'desc' },
    select: {
      id: true, email: true, firstName: true, lastName: true, phone: true,
      role: true, isEmailVerified: true, isActive: true,
      preferredLanguage: true, lastLoginAt: true, createdAt: true,
      _count: { select: { loans: true, reservations: true } },
    },
  });
  return { users, meta };
};

const getById = async (id) => {
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, firstName: true, lastName: true,
      role: true, isEmailVerified: true, isActive: true,
      preferredLanguage: true, lastLoginAt: true, createdAt: true,
      loans: {
        orderBy: { borrowedAt: 'desc' },
        take: 10,
        include: { book: { select: { id: true, title: true, author: true, coverUrl: true } } },
      },
    },
  });
  if (!user) { const err = new Error('Utilisateur introuvable.'); err.statusCode = 404; throw err; }
  return user;
};

const updateRole = async (id, role) => {
  return prisma.user.update({ where: { id }, data: { role }, select: { id: true, email: true, role: true } });
};

const toggleActive = async (id) => {
  const user = await prisma.user.findUnique({ where: { id } });
  if (!user) { const err = new Error('Utilisateur introuvable.'); err.statusCode = 404; throw err; }
  return prisma.user.update({ where: { id }, data: { isActive: !user.isActive }, select: { id: true, isActive: true } });
};

const getProfile = async (id) => {
  return prisma.user.findUnique({
    where: { id },
    select: {
      id: true, email: true, firstName: true, lastName: true, phone: true,
      role: true, preferredLanguage: true, lastLoginAt: true, createdAt: true,
    },
  });
};

const updateProfile = async (id, { firstName, lastName, phone, preferredLanguage, currentPassword, newPassword }) => {
  const user = await prisma.user.findUnique({ where: { id } });
  const data = { firstName, lastName, preferredLanguage };

  if (phone !== undefined) {
    // Normalise en gardant uniquement les chiffres et un éventuel « + » initial
    const cleaned = String(phone).trim();
    data.phone = cleaned === '' ? null : cleaned.replace(/[^\d+]/g, '');
  }

  if (newPassword) {
    if (!currentPassword) { const err = new Error('Mot de passe actuel requis.'); err.statusCode = 400; throw err; }
    const isValid = await bcrypt.compare(currentPassword, user.password);
    if (!isValid) { const err = new Error('Mot de passe actuel incorrect.'); err.statusCode = 401; throw err; }
    data.password = await bcrypt.hash(newPassword, 12);
  }

  return prisma.user.update({ where: { id }, data, select: { id: true, email: true, firstName: true, lastName: true, phone: true, preferredLanguage: true } });
};

const getAdminStats = async () => {
  const [totalUsers, totalBooks, activeLoans, overdueLoans, totalRequests, openRequests] = await Promise.all([
    prisma.user.count({ where: { isActive: true } }),
    prisma.book.count({ where: { isActive: true } }),
    prisma.loan.count({ where: { status: 'ACTIVE' } }),
    prisma.loan.count({ where: { status: 'OVERDUE' } }),
    prisma.bookRequest.count(),
    prisma.bookRequest.count({ where: { status: 'OPEN' } }),
  ]);

  const mostBorrowedBooks = await prisma.book.findMany({
    where: { isActive: true },
    orderBy: { loans: { _count: 'desc' } },
    take: 5,
    select: { id: true, title: true, author: true, coverUrl: true, _count: { select: { loans: true } } },
  });

  const recentLoans = await prisma.loan.findMany({
    orderBy: { borrowedAt: 'desc' },
    take: 10,
    include: {
      user: { select: { firstName: true, lastName: true } },
      book: { select: { title: true, author: true } },
    },
  });

  return { totalUsers, totalBooks, activeLoans, overdueLoans, totalRequests, openRequests, mostBorrowedBooks, recentLoans };
};

const getAuditLogs = async (query) => {
  const { skip, take, meta } = getPagination(query, await prisma.auditLog.count());
  const logs = await prisma.auditLog.findMany({
    skip, take,
    orderBy: { createdAt: 'desc' },
    include: { user: { select: { firstName: true, lastName: true, email: true } } },
  });
  return { logs, meta };
};

module.exports = { getAll, getById, updateRole, toggleActive, getProfile, updateProfile, getAdminStats, getAuditLogs };
