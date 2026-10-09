const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const prisma = require('../../config/database');

const LIBRARY_NAME = process.env.LIBRARY_NAME || 'Bibliothèque de la Congrégation';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

/**
 * Génère un PDF de l'inventaire complet des livres.
 */
const generateInventoryPDF = async (res) => {
  const books = await prisma.book.findMany({
    where: { isActive: true },
    orderBy: [{ title: 'asc' }],
    include: {
      categories: { include: { category: { select: { nameFr: true } } } },
      _count: { select: { loans: true } },
    },
  });

  const doc = new PDFDocument({ margin: 50, size: 'A4' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="inventaire-${new Date().toISOString().split('T')[0]}.pdf"`);
  doc.pipe(res);

  // En-tête
  doc.fontSize(22).font('Helvetica-Bold').text(LIBRARY_NAME, { align: 'center' });
  doc.fontSize(14).font('Helvetica').text('Inventaire des ouvrages', { align: 'center' });
  doc.fontSize(10).fillColor('#6B7280').text(`Généré le ${new Date().toLocaleDateString('fr-FR')} — ${books.length} ouvrage(s)`, { align: 'center' });
  doc.moveDown(1.5);

  // Ligne séparatrice
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.5);

  let index = 1;
  for (const book of books) {
    // Nouvelle page si nécessaire
    if (doc.y > 700) doc.addPage();

    const cats = book.categories.map((bc) => bc.category.nameFr).join(', ') || '—';
    const status = book.availableCopies > 0
      ? `Disponible (${book.availableCopies}/${book.totalCopies})`
      : `Emprunté (0/${book.totalCopies})`;

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1F2937')
      .text(`${index}. ${book.title}`, { continued: false });

    doc.fontSize(10).font('Helvetica').fillColor('#374151')
      .text(`   Auteur : ${book.author}${book.publishingHouse ? ` | Éditeur : ${book.publishingHouse}` : ''}${book.year ? ` | ${book.year}` : ''}`);

    doc.fillColor(book.availableCopies > 0 ? '#059669' : '#DC2626')
      .text(`   Statut : ${status}   | Catégories : ${cats}${book.isbn ? ` | ISBN : ${book.isbn}` : ''}`);

    doc.moveDown(0.4);
    index++;
  }

  // Pied de page
  doc.moveDown(1);
  doc.fontSize(9).fillColor('#9CA3AF').text(
    `Document confidentiel — ${LIBRARY_NAME}`,
    { align: 'center' }
  );

  doc.end();
};

/**
 * Génère un PDF de la fiche d'emprunt d'un utilisateur.
 */
const generateLoanSheetPDF = async (res, userId) => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      loans: {
        where: { status: { in: ['ACTIVE', 'OVERDUE', 'RENEWED'] } },
        include: { book: { select: { title: true, author: true, isbn: true } } },
        orderBy: { borrowedAt: 'desc' },
      },
    },
  });

  if (!user) throw Object.assign(new Error('Utilisateur introuvable.'), { statusCode: 404 });

  const doc = new PDFDocument({ margin: 50, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="emprunts-${user.lastName.toLowerCase()}.pdf"`);
  doc.pipe(res);

  doc.fontSize(20).font('Helvetica-Bold').text(LIBRARY_NAME, { align: 'center' });
  doc.fontSize(14).font('Helvetica').text('Fiche d\'emprunts', { align: 'center' });
  doc.moveDown();

  doc.fontSize(12).font('Helvetica-Bold').text(`${user.firstName} ${user.lastName}`);
  doc.fontSize(10).font('Helvetica').fillColor('#6B7280').text(`${user.email}`);
  doc.moveDown();

  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#E5E7EB').stroke();
  doc.moveDown(0.5);

  if (user.loans.length === 0) {
    doc.fontSize(11).fillColor('#374151').text('Aucun emprunt en cours.');
  } else {
    for (const loan of user.loans) {
      const due = new Date(loan.dueDate).toLocaleDateString('fr-FR');
      const isOverdue = loan.status === 'OVERDUE';

      doc.fontSize(11).font('Helvetica-Bold').fillColor('#1F2937')
        .text(`• ${loan.book.title}`);
      doc.fontSize(10).font('Helvetica').fillColor('#374151')
        .text(`  Auteur : ${loan.book.author}   |   Emprunté : ${new Date(loan.borrowedAt).toLocaleDateString('fr-FR')}`);
      doc.fillColor(isOverdue ? '#DC2626' : '#059669')
        .text(`  Retour prévu : ${due}${isOverdue ? '  ⚠ EN RETARD' : ''}`);
      doc.moveDown(0.5);
    }
  }

  doc.end();
};

/**
 * Génère le QR Code d'un livre (URL vers sa fiche).
 */
const generateBookQRCode = async (res, bookId) => {
  const book = await prisma.book.findUnique({
    where: { id: bookId },
    select: { id: true, title: true, author: true },
  });
  if (!book) throw Object.assign(new Error('Livre introuvable.'), { statusCode: 404 });

  const url = `${FRONTEND_URL}/pages/index.html#book/${bookId}`;
  const qrBuffer = await QRCode.toBuffer(url, { type: 'png', width: 300, margin: 2 });

  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Content-Disposition', `attachment; filename="qr-${book.id}.png"`);
  res.send(qrBuffer);
};

module.exports = { generateInventoryPDF, generateLoanSheetPDF, generateBookQRCode };
