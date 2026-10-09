const prisma = require('../../config/database');
const { getPagination } = require('../../utils/pagination');

const createReservation = async (userId, bookId) => {
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book || !book.isActive) {
    const err = new Error('Livre introuvable.'); err.statusCode = 404; throw err;
  }

  if (book.availableCopies > 0) {
    const err = new Error('Ce livre est disponible — empruntez-le directement.'); err.statusCode = 400; throw err;
  }

  const existing = await prisma.reservation.findFirst({
    where: { userId, bookId, status: { in: ['PENDING', 'NOTIFIED'] } },
  });
  if (existing) {
    const err = new Error('Vous êtes déjà en liste d\'attente pour ce livre.'); err.statusCode = 409; throw err;
  }

  const position = await prisma.reservation.count({ where: { bookId, status: { in: ['PENDING', 'NOTIFIED'] } } });

  return prisma.reservation.create({
    data: { userId, bookId, position: position + 1 },
    include: { book: { select: { id: true, title: true, author: true } } },
  });
};

const cancelReservation = async (reservationId, userId, userRole) => {
  const reservation = await prisma.reservation.findUnique({ where: { id: reservationId } });
  if (!reservation) { const err = new Error('Réservation introuvable.'); err.statusCode = 404; throw err; }
  if (reservation.userId !== userId && !['LIBRARIAN', 'ADMIN'].includes(userRole)) {
    const err = new Error('Accès refusé.'); err.statusCode = 403; throw err;
  }

  await prisma.reservation.update({ where: { id: reservationId }, data: { status: 'CANCELLED' } });
};

const getMyReservations = async (userId, query) => {
  const where = { userId };
  const { skip, take, meta } = getPagination(query, await prisma.reservation.count({ where }));
  const reservations = await prisma.reservation.findMany({
    where, skip, take,
    orderBy: { createdAt: 'desc' },
    include: { book: { select: { id: true, title: true, author: true, coverUrl: true } } },
  });
  return { reservations, meta };
};

const getBookReservations = async (bookId, query) => {
  const where = { bookId, status: { in: ['PENDING', 'NOTIFIED'] } };
  const { skip, take, meta } = getPagination(query, await prisma.reservation.count({ where }));
  const reservations = await prisma.reservation.findMany({
    where, skip, take,
    orderBy: { position: 'asc' },
    include: { user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });
  return { reservations, meta };
};

module.exports = { createReservation, cancelReservation, getMyReservations, getBookReservations };
