const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('./logger');

const prisma = new PrismaClient();

const DATA_PATH = path.join(__dirname, '..', '..', 'scripts', 'data', 'books-export.json');
const IMPORT_TAG = 'import-docx';

/**
 * Importe la bibliothèque initiale (les 136 livres) dans une base neuve.
 *
 * - Ne fait RIEN si des livres portant le tag « import-docx » existent déjà
 *   (donc idempotent : ne duplique jamais les livres).
 * - Ne touche jamais aux données existantes (utilisateurs, prêts, avis…).
 * - Lit le fichier `scripts/data/books-export.json` (produit par export-books.js).
 */
async function ensureBooks() {
  try {
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
  } catch (e) {
    logger.error("⚠️  Erreur pendant l'import initial de la bibliothèque :", e.message);
  } finally {
    await prisma.$disconnect().catch(() => {});
  }
}

module.exports = { ensureBooks };
