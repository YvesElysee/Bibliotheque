const prisma = require('../../config/database');
const { sendEmail } = require('../../config/email');
const { logger } = require('../../utils/logger');

const LIBRARY_NAME = process.env.LIBRARY_NAME || 'Bibliothèque de la Congrégation';

/**
 * Envoie une confirmation d'emprunt.
 */
const sendLoanConfirmation = async (loan) => {
  const { user, book, dueDate } = loan;
  if (!user?.email) return;

  const formattedDueDate = new Date(dueDate).toLocaleDateString('fr-FR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  await sendEmail({
    to: user.email,
    subject: `📚 Confirmation d'emprunt — ${book.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #4F46E5;">Emprunt confirmé</h2>
        <p>Bonjour ${user.firstName},</p>
        <p>Votre emprunt a bien été enregistré :</p>
        <div style="background:#F3F4F6;padding:16px;border-radius:8px;margin:16px 0;">
          <strong>${book.title}</strong><br>
          <span style="color:#6B7280;">${book.author}</span>
        </div>
        <p>📅 Date de retour prévue : <strong>${formattedDueDate}</strong></p>
        <p style="color:#6B7280;font-size:12px;">— ${LIBRARY_NAME}</p>
      </div>
    `,
  }).catch((e) => logger.warn('Email confirmation emprunt non envoyé:', e.message));

  // Enregistrement en base
  await prisma.notification.create({
    data: {
      userId: user.id,
      type: 'LOAN_CONFIRMATION',
      subject: `Confirmation d'emprunt — ${book.title}`,
      body: `Vous avez emprunté "${book.title}". Date de retour : ${formattedDueDate}.`,
    },
  }).catch(() => {});
};

/**
 * Envoie des rappels pour les emprunts qui arrivent à échéance dans N jours.
 */
const sendLoanReminders = async (daysBeforeDue = 3) => {
  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + daysBeforeDue);
  const dayStart = new Date(targetDate.setHours(0, 0, 0, 0));
  const dayEnd = new Date(targetDate.setHours(23, 59, 59, 999));

  const loans = await prisma.loan.findMany({
    where: {
      status: { in: ['ACTIVE', 'RENEWED'] },
      dueDate: { gte: dayStart, lte: dayEnd },
    },
    include: {
      user: { select: { id: true, firstName: true, email: true } },
      book: { select: { id: true, title: true, author: true } },
    },
  });

  logger.info(`Rappels emprunt J-${daysBeforeDue}: ${loans.length} email(s) à envoyer.`);

  for (const loan of loans) {
    if (!loan.user?.email) continue;

    const formattedDueDate = new Date(loan.dueDate).toLocaleDateString('fr-FR', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

    await sendEmail({
      to: loan.user.email,
      subject: `⏰ Rappel de retour — ${loan.book.title}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #EF4444;">Rappel de retour</h2>
          <p>Bonjour ${loan.user.firstName},</p>
          <p>Vous devez retourner ce livre dans <strong>${daysBeforeDue} jour(s)</strong> :</p>
          <div style="background:#FEF2F2;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #EF4444;">
            <strong>${loan.book.title}</strong><br>
            <span style="color:#6B7280;">${loan.book.author}</span>
          </div>
          <p>📅 Date limite de retour : <strong>${formattedDueDate}</strong></p>
          <p style="color:#6B7280;font-size:12px;">— ${LIBRARY_NAME}</p>
        </div>
      `,
    }).catch((e) => logger.warn(`Rappel non envoyé à ${loan.user.email}:`, e.message));

    await prisma.notification.create({
      data: {
        userId: loan.user.id,
        type: 'LOAN_REMINDER',
        subject: `Rappel de retour — ${loan.book.title}`,
        body: `Retour prévu le ${formattedDueDate}.`,
      },
    }).catch(() => {});
  }

  return loans.length;
};

/**
 * Notifie le prochain utilisateur en file d'attente qu'un livre est disponible.
 */
const notifyNextInQueue = async (bookId) => {
  const nextReservation = await prisma.reservation.findFirst({
    where: { bookId, status: 'PENDING' },
    orderBy: { position: 'asc' },
    include: {
      user: { select: { id: true, firstName: true, email: true } },
      book: { select: { id: true, title: true } },
    },
  });

  if (!nextReservation || !nextReservation.user?.email) return;

  const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48h pour confirmer

  await prisma.reservation.update({
    where: { id: nextReservation.id },
    data: { status: 'NOTIFIED', notifiedAt: new Date(), expiresAt },
  });

  await sendEmail({
    to: nextReservation.user.email,
    subject: `✅ Livre disponible — ${nextReservation.book.title}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #10B981;">Bonne nouvelle !</h2>
        <p>Bonjour ${nextReservation.user.firstName},</p>
        <p>Le livre que vous attendiez est maintenant disponible :</p>
        <div style="background:#ECFDF5;padding:16px;border-radius:8px;margin:16px 0;border-left:4px solid #10B981;">
          <strong>${nextReservation.book.title}</strong>
        </div>
        <p>⚠️ Cette réservation expire dans <strong>48 heures</strong>. Veuillez vous rendre à la bibliothèque.</p>
        <p style="color:#6B7280;font-size:12px;">— ${LIBRARY_NAME}</p>
      </div>
    `,
  }).catch((e) => logger.warn('Email file d\'attente non envoyé:', e.message));
};

module.exports = { sendLoanConfirmation, sendLoanReminders, notifyNextInQueue };
