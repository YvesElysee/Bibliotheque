#!/usr/bin/env node
/**
 * Exporte les livres + leurs catégories depuis la base courante (DATABASE_URL)
 * vers `scripts/data/books-export.json`.
 *
 * Ce fichier sert ensuite à l'import automatique au démarrage
 * (src/utils/ensureBooks.js) sur une base neuve (ex. Render).
 *
 * Usage (depuis backend/) :
 *   node scripts/export-books.js
 *   node scripts/export-books.js --tag import-docx   (uniquement ces livres)
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const opt = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};
const TAG = opt('--tag', null);

async function main() {
  const where = TAG ? { tags: { has: TAG } } : {};
  const books = await prisma.book.findMany({
    where,
    include: { categories: { include: { category: true } } },
    orderBy: { title: 'asc' },
  });

  const catSlugs = new Set();
  for (const b of books) for (const bc of b.categories) catSlugs.add(bc.category.slug);

  const categories = await prisma.category.findMany({
    where: { slug: { in: [...catSlugs] } },
  });

  const payload = {
    version: 1,
    generatedAt: new Date().toISOString(),
    source: 'scripts/export-books.js',
    categories: categories.map((c) => ({
      nameEn: c.nameEn,
      nameFr: c.nameFr,
      slug: c.slug,
      description: c.description,
      color: c.color,
      icon: c.icon,
    })),
    books: books.map((b) => ({
      title: b.title,
      author: b.author,
      publisher: b.publisher,
      publishingHouse: b.publishingHouse,
      isbn: b.isbn,
      year: b.year,
      edition: b.edition,
      language: b.language,
      pageCount: b.pageCount,
      summary: b.summary,
      coverUrl: b.coverUrl,
      totalCopies: b.totalCopies,
      availableCopies: b.availableCopies,
      location: b.location,
      tags: b.tags,
      isActive: b.isActive,
      categories: b.categories.map((bc) => bc.category.slug),
    })),
  };

  const out = path.join(__dirname, 'data', 'books-export.json');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(payload, null, 2), 'utf8');
  console.log(
    `✅ Export : ${payload.books.length} livres, ${payload.categories.length} catégories → ${out}`
  );
}

main()
  .catch((e) => {
    console.error('💥', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
