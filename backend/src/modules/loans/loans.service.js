const prisma = require('../../config/database');
const { getPagination } = require('../../utils/pagination');
const notificationsService = require('../notifications/notifications.service');

const DEFAULT_LOAN_DAYS = parseInt(process.env.DEFAULT_LOAN_DAYS || '21');
const MAX_ACTIVE_LOANS = parseInt(process.env.MAX_ACTIVE_LOANS || '3');

const createLoan = async ({ userId, bookId, notes, dueDateOverride }, registeredBy) => {
  // Vérification exemplaires disponibles
  const book = await prisma.book.findUnique({ where: { id: bookId } });
  if (!book || !book.isActive) {
    const err = new Error('Livre introuvable.'); err.statusCode = 404; throw err;
  }
  if (book.availableCopies < 1) {
    const err = new Error('Aucun exemplaire disponible pour ce livre.'); err.statusCode = 409; throw err;
  }

  // Vérification limite d'emprunts actifs
  const activeLoans = await prisma.loan.count({ where: { userId, status: 'ACTIVE' } });
  if (activeLoans >= MAX_ACTIVE_LOANS) {
    const err = new Error(`Limite d'emprunts simultanés atteinte (${MAX_ACTIVE_LOANS}).`); err.statusCode = 409; throw err;
  }

  // Vérification emprunt déjà en cours
  const existing = await prisma.loan.findFirst({ where: { userId, bookId, status: 'ACTIVE' } });
  if (existing) {
    const err = new Error('Cet utilisateur a déjà emprunté ce livre.'); err.statusCode = 409; throw err;
  }

  const dueDate = dueDateOverride
    ? new Date(dueDateOverride)
    : new Date(Date.now() + DEFAULT_LOAN_DAYS * 24 * 60 * 60 * 1000);

  const [loan] = await prisma.$transaction([
    prisma.loan.create({
      data: { userId, bookId, dueDate, notes, registeredBy, status: 'ACTIVE' },
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true } },
        book: { select: { id: true, title: true, author: true } },
      },
    }),
    prisma.book.update({ where: { id: bookId }, data: { availableCopies: { decrement: 1 } } }),
  ]);

  // Annuler la réservation de l'utilisateur s'il en avait une
  await prisma.reservation.updateMany({
    where: { userId, bookId, status: 'NOTIFIED' },
    data: { status: 'CONFIRMED' },
  });

  // Notification de confirmation
  await notificationsService.sendLoanConfirmation(loan);

  return loan;
};

const returnLoan = async (loanId, returnedBy) => {
  const loan = await prisma.loan.findUnique({
    where: { id: loanId },
    include: { book: true, user: { select: { id: true, firstName: true, lastName: true, email: true } } },
  });

  if (!loan) { const err = new Error('Emprunt introuvable.'); err.statusCode = 404; throw err; }
  if (loan.status === 'RETURNED') { const err = new Error('Ce livre a déjà été rendu.'); err.statusCode = 409; throw err; }

  const [updatedLoan] = await prisma.$transaction([
    prisma.loan.update({
      where: { id: loanId },
      data: { status: 'RETURNED', returnedAt: new Date() },
      include: { book: { select: { id: true, title: true, author: true } } },
    }),
    prisma.book.update({ where: { id: loan.bookId }, data: { availableCopies: { increment: 1 } } }),
  ]);

  // Notifier le prochain en file d'attente
  await notificationsService.notifyNextInQueue(loan.bookId);

  return updatedLoan;
};

const renewLoan = async (loanId, userId) => {
  const loan = await prisma.loan.findUnique({ where: { id: loanId } });
  if (!loan) { const err = new Error('Emprunt introuvable.'); err.statusCode = 404; throw err; }
  if (loan.userId !== userId) { const err = new Error('Accès refusé.'); err.statusCode = 403; throw err; }
  if (loan.status !== 'ACTIVE') { const err = new Error('Cet emprunt ne peut pas être renouvelé.'); err.statusCode = 409; throw err; }
  if (loan.renewalCount >= loan.maxRenewals) {
    const err = new Error(`Nombre maximum de renouvellements atteint (${loan.maxRenewals}).`); err.statusCode = 409; throw err;
  }

  // Vérifier si une réservation est en attente
  const reservation = await prisma.reservation.findFirst({
    where: { bookId: loan.bookId, status: { in: ['PENDING', 'NOTIFIED'] } },
  });
  if (reservation) {
    const err = new Error('Ce livre est réservé par un autre membre, le renouvellement n\'est pas possible.'); err.statusCode = 409; throw err;
  }

  const newDueDate = new Date(loan.dueDate.getTime() + DEFAULT_LOAN_DAYS * 24 * 60 * 60 * 1000);

  const updated = await prisma.loan.update({
    where: { id: loanId },
    data: { dueDate: newDueDate, renewedAt: new Date(), renewalCount: { increment: 1 }, status: 'RENEWED' },
    include: { book: { select: { id: true, title: true } } },
  });

  return updated;
};

const getMyLoans = async (userId, query) => {
  const { status } = query;
  const where = { userId };
  if (status) where.status = status;

  const { skip, take, meta } = getPagination(query, await prisma.loan.count({ where }));

  const loans = await prisma.loan.findMany({
    where,
    skip,
    take,
    orderBy: { borrowedAt: 'desc' },
    include: {
      book: { select: { id: true, title: true, author: true, coverUrl: true } },
    },
  });

  return { loans, meta };
};

const getAllLoans = async (query) => {
  const { status, userId, bookId } = query;
  const where = {};
  if (status) where.status = status;
  if (userId) where.userId = userId;
  if (bookId) where.bookId = bookId;

  const { skip, take, meta } = getPagination(query, await prisma.loan.count({ where }));

  const loans = await prisma.loan.findMany({
    where,
    skip,
    take,
    orderBy: { borrowedAt: 'desc' },
    include: {
      user: { select: { id: true, firstName: true, lastName: true, email: true } },
      book: { select: { id: true, title: true, author: true, coverUrl: true } },
    },
  });

  return { loans, meta };
};

// Mettre à jour les emprunts en retard (appelé par le scheduler)
const markOverdueLoans = async () => {
  const result = await prisma.loan.updateMany({
    where: { status: 'ACTIVE', dueDate: { lt: new Date() } },
    data: { status: 'OVERDUE' },
  });
  return result.count;
};

module.exports = { createLoan, returnLoan, renewLoan, getMyLoans, getAllLoans, markOverdueLoans };
