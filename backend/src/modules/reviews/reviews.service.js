const prisma = require('../../config/database');

const createOrUpdateReview = async (userId, bookId, { rating, comment }) => {
  // Vérifier que l'utilisateur a déjà emprunté ce livre
  const hasBorrowed = await prisma.loan.findFirst({
    where: { userId, bookId, status: { in: ['RETURNED', 'ACTIVE', 'OVERDUE', 'RENEWED'] } },
  });
  if (!hasBorrowed) {
    const err = new Error('Vous devez avoir emprunté ce livre pour laisser un avis.'); err.statusCode = 403; throw err;
  }

  return prisma.review.upsert({
    where: { userId_bookId: { userId, bookId } },
    update: { rating, comment },
    create: { userId, bookId, rating, comment },
    include: { user: { select: { id: true, firstName: true, lastName: true } } },
  });
};

const deleteReview = async (reviewId, userId, userRole) => {
  const review = await prisma.review.findUnique({ where: { id: reviewId } });
  if (!review) { const err = new Error('Avis introuvable.'); err.statusCode = 404; throw err; }
  if (review.userId !== userId && !['ADMIN'].includes(userRole)) {
    const err = new Error('Accès refusé.'); err.statusCode = 403; throw err;
  }
  await prisma.review.delete({ where: { id: reviewId } });
};

module.exports = { createOrUpdateReview, deleteReview };
