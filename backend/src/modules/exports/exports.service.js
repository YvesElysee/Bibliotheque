const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const prisma = require('../../config/database');

const LIBRARY_NAME = process.env.LIBRARY_NAME || 'Bibliothèque Scolasticat Père Piariste';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5500';

/**
 * Génère un PDF de l'inventaire complet des livres.
 * Design épuré : en-tête centré, une information par ligne, statut en couleur,
 * aucun tiret ni barre oblique de mise en forme, numéros de page en pied.
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

  const doc = new PDFDocument({ margin: 50, size: 'A4', bufferPages: true });
  const dateLong = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="Inventaire des ouvrages.pdf"');
  doc.pipe(res);

  // ─── En-tête ───────────────────────────────────────────────
  doc.fontSize(20).font('Helvetica-Bold').fillColor('#111827').text(LIBRARY_NAME, { align: 'center' });
  doc.moveDown(0.3);
  doc.fontSize(13).font('Helvetica').fillColor('#4F46E5').text('Inventaire des ouvrages', { align: 'center' });
  doc.moveDown(0.4);
  doc.fontSize(10).font('Helvetica').fillColor('#6B7280').text(`Généré le ${dateLong}`, { align: 'center' });
  doc.text(`${books.length} ouvrages au total`, { align: 'center' });
  doc.moveDown(0.8);
  doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#D1D5DB').lineWidth(0.8).stroke();
  doc.moveDown(1);

  // ─── Liste des ouvrages ───────────────────────────────────
  let index = 1;
  for (const book of books) {
    if (doc.y > 700) doc.addPage();

    const cats = book.categories.map((bc) => bc.category.nameFr).join(', ') || 'Non classé';
    const dispo = book.availableCopies > 0;
    const statut = dispo ? 'Disponible' : 'Emprunté';

    // Titre de l'ouvrage
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#111827').text(`${index}. ${book.title}`);
    doc.moveDown(0.2);

    // Informations, une par ligne, sans tirets ni barres obliques de mise en forme
    doc.fontSize(9.5).font('Helvetica').fillColor('#374151');
    doc.text(`Auteur : ${book.author || 'Non renseigné'}`);
    if (book.publishingHouse) doc.text(`Éditeur : ${book.publishingHouse}`);
    if (book.year) doc.text(`Année : ${book.year}`);
    doc.text(`Catégories : ${cats}`);
    if (book.isbn) doc.text(`ISBN : ${book.isbn}`);

    // Statut mis en couleur
    doc.fillColor(dispo ? '#047857' : '#B91C1C')
      .text(`Statut : ${statut} (${book.availableCopies} sur ${book.totalCopies} exemplaires disponibles)`);

    doc.moveDown(0.8);

    // Séparateur discret entre deux ouvrages
    if (index < books.length) {
      doc.moveTo(50, doc.y).lineTo(545, doc.y).strokeColor('#F1F5F9').lineWidth(0.5).stroke();
      doc.moveDown(0.8);
    }
    index++;
  }

  // ─── Numéros de page ──────────────────────────────────────
  const range = doc.bufferedPageRange();
  const total = range.count;
  for (let i = 0; i < total; i++) {
    doc.switchToPage(i);
    doc.fontSize(8).fillColor('#9CA3AF').text(
      `Page ${i + 1} sur ${total}   ${LIBRARY_NAME}`,
      50, doc.page.height - 40, { align: 'center', width: doc.page.width - 100, lineBreak: false }
    );
  }

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
        .text(`  Auteur : ${loan.book.author}`);
      doc.text(`  Emprunté le : ${new Date(loan.borrowedAt).toLocaleDateString('fr-FR')}`);
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
