#!/usr/bin/env node
/**
 * Import en masse des livres extraits des fichiers .docx
 * (Théologie / Philosophie / Littérature) vers la base de données.
 *
 * Usage (depuis backend/) :
 *   node scripts/import-books.js [options]
 *
 * Options :
 *   --reset              Efface TOUS les livres existants avant l'import.
 *   --limit N            N'importe que les N premiers livres (test).
 *   --ai                 Génère les résumés IA (désactivé par défaut).
 *   --no-cover           Ne cherche pas les couvertures en ligne.
 *   --delay MS           Délai entre deux appels IA (défaut : 4200 ms).
 *   --dry-run            Simule sans écrire en base.
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const { generateBookSummary } = require('../src/modules/books/aiSummary.service');
const { searchCoverByTitle } = require('../src/modules/books/books.lookup.service');

const prisma = new PrismaClient();

const args = process.argv.slice(2);
const has = (f) => args.includes(f);
const opt = (f, d) => {
  const i = args.indexOf(f);
  return i >= 0 && args[i + 1] ? args[i + 1] : d;
};

const RESET = has('--reset');
const USE_AI = has('--ai');
const NO_COVER = has('--no-cover');
const DRY = has('--dry-run');
const LIMIT = parseInt(opt('--limit', '0'), 10) || 0;
const DELAY = parseInt(opt('--delay', '4200'), 10);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const CATEGORY_BY_DOC = {
  'Théologie': 'theology',
  'Philosophie': 'philosophy',
  'Littérature': 'literature',
};

const DICO_HINTS = [
  'dictionn', 'dictionary', 'grammaire', 'phrasal verbs', 'essential indonesian',
  'french in three months', 'traduire de l',
];

const slugify = (s) => String(s).toLowerCase().normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

async function ensureCategories() {
  const wanted = [
    { nameFr: 'Littérature', nameEn: 'Literature', slug: 'literature', color: '#db2777', icon: 'book-open' },
    { nameFr: 'Dictionnaires', nameEn: 'Dictionaries', slug: 'dictionaries', color: '#0891b2', icon: 'book' },
  ];
  const map = {};
  for (const w of wanted) {
    let cat = await prisma.category.findUnique({ where: { slug: w.slug } });
    if (!cat) {
      cat = await prisma.category.create({ data: w });
      console.log(`  + Catégorie créée : ${w.nameFr}`);
    }
    map[w.slug] = cat.id;
  }
  // Catégories existantes (théologie, philosophie…)
  for (const slug of ['theology', 'philosophy']) {
    const cat = await prisma.category.findUnique({ where: { slug } });
    if (cat) map[slug] = cat.id;
  }
  return map;
}

async function resetBooks() {
  console.log('⚠️  --reset : suppression de tous les livres existants…');
  const del = await prisma.loan.deleteMany({});
  const rev = await prisma.review.deleteMany({});
  const resv = await prisma.reservation.deleteMany({});
  const bc = await prisma.bookCategory.deleteMany({});
  const books = await prisma.book.deleteMany({});
  console.log(`   Supprimés : ${books.count} livres, ${bc.count} liens catégories, ${del.count} prêts, ${rev.count} avis, ${resv.count} réservations.`);
}

async function generateSummarySafe(book) {
  const tries = 3;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const text = await generateBookSummary({
        title: book.title,
        author: book.author || undefined,
        year: book.year || undefined,
      });
      if (text && text.trim()) return text.trim();
    } catch (e) {
      const last = attempt === tries;
      process.stdout.write(`\n      ⚠️  IA échec (essai ${attempt}/${tries}) : ${e.message}`);
      if (!last) await sleep(15000);
    }
  }
  return null;
}

async function main() {
  const dataPath = path.join(__dirname, 'data', 'books-import.json');
  let books = JSON.parse(fs.readFileSync(dataPath, 'utf8'));
  if (LIMIT) books = books.slice(0, LIMIT);

  console.log(`\n📚 Import de ${books.length} livres`);
  console.log(`   IA: ${USE_AI ? 'oui' : 'non'} | Couvertures: ${NO_COVER ? 'non' : 'oui'} | Reset: ${RESET ? 'oui' : 'non'} | Dry-run: ${DRY ? 'oui' : 'non'}\n`);

  if (DRY) { books.forEach((b) => console.log('  •', b.category, '|', b.author, '|', b.title)); return; }

  const catMap = await ensureCategories();
  if (RESET) await resetBooks();

  // addedBy : premier administrateur
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' }, orderBy: { createdAt: 'asc' } });
  const addedBy = admin?.id || null;

  let aiOk = 0, aiFail = 0, covOk = 0, covFail = 0, created = 0, errors = 0;
  const started = Date.now();

  for (let i = 0; i < books.length; i++) {
    const b = books[i];
    const n = i + 1;
    const label = `${n}/${books.length}`;

    let summary = null;
    if (USE_AI) {
      process.stdout.write(`\r[${label}] ${b.title.slice(0, 55).padEnd(55)} — résumé IA…        `);
      summary = await generateSummarySafe(b);
      if (summary) aiOk++; else aiFail++;
    }

    let coverUrl = null;
    if (!NO_COVER) {
      process.stdout.write(`\r[${label}] ${b.title.slice(0, 55).padEnd(55)} — couverture…       `);
      try {
        coverUrl = await searchCoverByTitle(b.title, b.author);
      } catch (e) { coverUrl = null; }
      if (coverUrl) covOk++; else covFail++;
    }

    const slugs = [CATEGORY_BY_DOC[b.category]].filter(Boolean);
    if (DICO_HINTS.some((h) => b.title.toLowerCase().includes(h))) slugs.push('dictionaries');

    try {
      await prisma.book.create({
        data: {
          title: b.title.slice(0, 255),
          author: (b.author || 'Auteur inconnu').slice(0, 255),
          publishingHouse: b.publishingHouse || null,
          year: b.year || null,
          language: b.language || 'FR',
          summary,
          coverUrl,
          location: b.location || null,
          tags: ['import-docx', b.source],
          totalCopies: 1,
          availableCopies: 1,
          addedBy,
          isActive: true,
          categories: {
            create: slugs.filter((s) => catMap[s]).map((s) => ({ categoryId: catMap[s] })),
          },
        },
      });
      created++;
    } catch (e) {
      errors++;
      console.log(`\n   ❌ Erreur création « ${b.title} » : ${e.message}`);
    }

    process.stdout.write(`\r[${label}] OK ✓ ${b.title.slice(0, 50).padEnd(50)}                    \n`);

    if (USE_AI && i < books.length - 1) await sleep(DELAY);
  }

  const dur = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`\n✅ Terminé en ${dur}s`);
  console.log(`   Livres créés : ${created} (erreurs : ${errors})`);
  console.log(`   Résumés IA   : ${aiOk} réussis / ${aiFail} échecs`);
  console.log(`   Couvertures  : ${covOk} trouvées / ${covFail} introuvables`);
}

main()
  .catch((e) => { console.error('\n💥', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
