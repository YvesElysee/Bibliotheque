const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

const prisma = new PrismaClient();

const DATA_PATH = path.join(__dirname, '..', '..', 'scripts', 'data', 'books-export.json');
const IMPORT_TAG = 'import-docx';

/**
 * ISBN des « livres d'exemple » créés par l'ancien seed (prisma/seed.js).
 * Aucun livre réel n'a d'ISBN → on peut les identifier et les supprimer
 * sans aucun risque pour le vrai catalogue.
 */
const SAMPLE_ISBNS = [
  '9782080701191', // Les Confessions
  '9782204039122', // Somme théologique
  '9782283600347', // Introduction à la vie dévote
  '9782204071125', // L'Imitation de Jésus-Christ
  '9782226189348', // Les Pères de l'Église
  '9782204078377', // Le Nouveau Testament
  '9782204080103', // Constitution sur la sainte liturgie
  '9782718909295', // Code de droit canonique
];

/**
 * Importe la bibliothèque initiale (les 136 livres) dans une base neuve.
 * Idempotent : ne fait rien si des livres « import-docx » existent déjà.
 */
async function importLibrary() {
  const already = await prisma.book.count({ where: { tags: { has: IMPORT_TAG } } });
  if (already > 0) {
    logger.info(`📚 Bibliothèque déjà importée (${already} livres) — import ignoré.`);
    return;
  }

  if (!fs.existsSync(DATA_PATH)) {
    logger.warn('📚 Fichier scripts/data/books-export.json introuvable — import ignoré.');
    return;
  }

  const payload = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));
  const books = Array.isArray(payload.books) ? payload.books : [];
  const categories = Array.isArray(payload.categories) ? payload.categories : [];
  if (books.length === 0) {
    logger.warn('📚 Aucun livre à importer.');
    return;
  }

  logger.info(`📚 Base vide — import initial de la bibliothèque (${books.length} livres)…`);

  // 1) Catégories (créées seulement si absentes)
  const catIdBySlug = {};
  for (const c of categories) {
    let cat = await prisma.category.findUnique({ where: { slug: c.slug } });
    if (!cat) {
      cat = await prisma.category.create({
        data: {
          nameEn: c.nameEn,
          nameFr: c.nameFr,
          slug: c.slug,
          description: c.description || null,
          color: c.color || '#6B7280',
          icon: c.icon || 'book',
        },
      });
    }
    catIdBySlug[c.slug] = cat.id;
  }

  // 2) Auteur de l'ajout : le premier administrateur (sinon null)
  const admin = await prisma.user.findFirst({
    where: { role: 'ADMIN' },
    orderBy: { createdAt: 'asc' },
  });
  const addedBy = admin?.id || null;

  // 3) Livres
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const b of books) {
    try {
      const dup = await prisma.book.findFirst({
        where: { title: b.title, author: b.author },
        select: { id: true },
      });
      if (dup) {
        skipped++;
        continue;
      }

      // ISBN unique : on le retire s'il est déjà pris dans la base cible
      let isbn = b.isbn || null;
      if (isbn) {
        const existing = await prisma.book.findUnique({ where: { isbn }, select: { id: true } });
        if (existing) isbn = null;
      }

      const book = await prisma.book.create({
        data: {
          title: b.title,
          author: b.author,
          publisher: b.publisher || null,
          publishingHouse: b.publishingHouse || null,
          isbn,
          year: b.year || null,
          edition: b.edition || null,
          language: b.language || 'fr',
          pageCount: b.pageCount || null,
          summary: b.summary || null,
          coverUrl: b.coverUrl || null,
          totalCopies: b.totalCopies ?? 1,
          availableCopies: b.availableCopies ?? 1,
          location: b.location || null,
          tags: Array.isArray(b.tags) ? b.tags : [],
          isActive: b.isActive ?? true,
          addedBy,
        },
      });

      const links = (b.categories || [])
        .map((slug) => ({ bookId: book.id, categoryId: catIdBySlug[slug] }))
        .filter((x) => x.categoryId);
      if (links.length) {
        await prisma.bookCategory.createMany({ data: links, skipDuplicates: true });
      }

      created++;
    } catch (e) {
      errors++;
      logger.warn(`   ⚠️  Livre ignoré « ${b.title} » : ${e.message}`);
    }
  }

  logger.info(`✅ Bibliothèque importée : ${created} créés, ${skipped} déjà présents, ${errors} erreurs.`);
}

/**
 * Supprime les livres d'exemple du seed pour ne garder que le vrai catalogue.
 */
async function removeSampleBooks() {
  const samples = await prisma.book.findMany({
    where: { isbn: { in: SAMPLE_ISBNS } },
    select: { id: true },
  });
  if (samples.length === 0) return;

  const ids = samples.map((s) => s.id);
  // Nettoyage des données liées (sécurité : évite les erreurs de clé étrangère)
  await prisma.loan.deleteMany({ where: { bookId: { in: ids } } });
  await prisma.reservation.deleteMany({ where: { bookId: { in: ids } } });
  await prisma.review.deleteMany({ where: { bookId: { in: ids } } });
  await prisma.bookCategory.deleteMany({ where: { bookId: { in: ids } } });
  await prisma.book.deleteMany({ where: { id: { in: ids } } });

  logger.info(`🧹 ${ids.length} livres d'exemple supprimés (catalogue réel uniquement).`);
}

/**
 * Point d'entrée appelé au démarrage du serveur.
 * 1) importe les 136 livres si nécessaire  2) retire les livres d'exemple.
 */
async function ensureBooks() {
  try {
    await importLibrary();
  } catch (e) {
    logger.error("⚠️  Erreur pendant l'import initial de la bibliothèque :", e.message);
  }

  try {
    await removeSampleBooks();
  } catch (e) {
    logger.warn("⚠️  Nettoyage des livres d'exemple impossible :", e.message);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

module.exports = { ensureBooks };
