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

/**
 * Génère une feuille d'étiquettes imprimables (QR codes) à coller sur les livres.
 * Grille de 3 colonnes ; chaque étiquette : QR code, titre, auteur, cote.
 * @param {object} res - réponse Express
 * @param {string[]} [ids] - sous-ensemble d'identifiants de livres (sinon tous)
 */
const generateBookLabelsPDF = async (res, ids) => {
  const where = { isActive: true };
  if (Array.isArray(ids) && ids.length > 0) where.id = { in: ids };

  const books = await prisma.book.findMany({
    where,
    orderBy: [{ title: 'asc' }],
    select: { id: true, title: true, author: true, location: true },
    take: 600, // garde-fou
  });

  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', 'attachment; filename="etiquettes-qr.pdf"');
  doc.pipe(res);

  const PAGE_W = doc.page.width; // 595
  const PAGE_H = doc.page.height; // 842
  const MARGIN = 28;
  const HEADER_H = 34;
  const COLS = 3;
  const ROWS = 7;
  const GAP_X = 8;
  const GAP_Y = 8;

  const gridTop = MARGIN + HEADER_H;
  const usableW = PAGE_W - MARGIN * 2;
  const usableH = PAGE_H - gridTop - MARGIN;
  const labelW = (usableW - GAP_X * (COLS - 1)) / COLS;
  const labelH = (usableH - GAP_Y * (ROWS - 1)) / ROWS;

  const drawHeader = () => {
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#4F46E5')
      .text(LIBRARY_NAME, MARGIN, MARGIN - 4, { width: PAGE_W - MARGIN * 2, align: 'left' });
    doc.fontSize(8).font('Helvetica').fillColor('#6B7280')
      .text('Étiquettes QR des ouvrages', MARGIN, MARGIN + 11, { width: PAGE_W - MARGIN * 2 });
    doc.moveTo(MARGIN, MARGIN + 24).lineTo(PAGE_W - MARGIN, MARGIN + 24)
      .strokeColor('#E5E7EB').lineWidth(0.6).stroke();
  };

  drawHeader();
  let slot = 0;

  for (const book of books) {
    const col = slot % COLS;
    const row = Math.floor(slot / COLS) % ROWS;

    if (slot > 0 && col === 0 && row === 0) {
      doc.addPage();
      drawHeader();
    }

    const x = MARGIN + col * (labelW + GAP_X);
    const y = gridTop + row * (labelH + GAP_Y);

    // Cadre de l'étiquette (pointillés légers pour le découpage)
    doc.roundedRect(x, y, labelW, labelH, 4)
      .strokeColor('#CBD5E1').lineWidth(0.6).dash(2, { space: 3 }).stroke().undash();

    // QR code
    const qrSize = labelH - 12;
    const url = `${FRONTEND_URL}/pages/index.html#book/${book.id}`;
    // eslint-disable-next-line no-await-in-loop
    const qrBuffer = await QRCode.toBuffer(url, { type: 'png', width: 256, margin: 1 });
    doc.image(qrBuffer, x + 6, y + 6, { width: qrSize, height: qrSize });

    // Texte
    const textX = x + qrSize + 12;
    const textW = labelW - qrSize - 18;
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#111827')
      .text(book.title, textX, y + 8, { width: textW, height: 28, ellipsis: true, lineGap: 1 });
    doc.fontSize(7).font('Helvetica').fillColor('#4B5563')
      .text(book.author || 'Auteur non renseigné', textX, doc.y + 1, { width: textW, height: 20, ellipsis: true });
    if (book.location) {
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#4F46E5')
        .text(`Cote : ${book.location}`, textX, doc.y + 1, { width: textW, height: 12, ellipsis: true });
    }

    slot++;
  }

  if (books.length === 0) {
    doc.fontSize(12).fillColor('#6B7280')
      .text('Aucun ouvrage à étiqueter.', MARGIN, gridTop, { align: 'center', width: usableW });
  }

  // Pied de page : numérotation
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(i);
    doc.fontSize(7).fillColor('#9CA3AF').text(
      `Page ${i + 1} sur ${range.count}   ${LIBRARY_NAME}`,
      0, PAGE_H - 18, { align: 'center', width: PAGE_W, lineBreak: false }
    );
  }

  doc.end();
};

module.exports = {
  generateInventoryPDF,
  generateLoanSheetPDF,
  generateBookQRCode,
  generateBookLabelsPDF,
};
