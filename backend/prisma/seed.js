const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Initialisation de la base de données...');

  // Catégories par défaut
  const categories = [
    { nameEn: 'Theology', nameFr: 'Théologie', slug: 'theology', color: '#7C3AED', icon: 'church' },
    { nameEn: 'Philosophy', nameFr: 'Philosophie', slug: 'philosophy', color: '#2563EB', icon: 'lightbulb' },
    { nameEn: 'Spirituality', nameFr: 'Spiritualité', slug: 'spirituality', color: '#059669', icon: 'star' },
    { nameEn: 'History', nameFr: 'Histoire', slug: 'history', color: '#D97706', icon: 'clock' },
    { nameEn: 'Scripture', nameFr: 'Écriture Sainte', slug: 'scripture', color: '#DC2626', icon: 'book-open' },
    { nameEn: 'Liturgy', nameFr: 'Liturgie', slug: 'liturgy', color: '#9333EA', icon: 'music' },
    { nameEn: 'Canon Law', nameFr: 'Droit Canon', slug: 'canon-law', color: '#0891B2', icon: 'scale' },
    { nameEn: 'Patristics', nameFr: 'Patristique', slug: 'patristics', color: '#65A30D', icon: 'users' },
    { nameEn: 'Ethics', nameFr: 'Éthique', slug: 'ethics', color: '#EA580C', icon: 'heart' },
    { nameEn: 'Missions', nameFr: 'Missions', slug: 'missions', color: '#0D9488', icon: 'globe' },
  ];

  for (const cat of categories) {
    await prisma.category.upsert({
      where: { slug: cat.slug },
      update: {},
      create: cat,
    });
  }
  console.log(`✅ ${categories.length} catégories créées.`);

  // Comptes d'utilisateurs
  const usersToSeed = [
    {
      email: 'admin@bibliotheque.local',
      passwordPlain: 'Admin@Biblio2024!',
      firstName: 'Administrateur',
      lastName: 'Système',
      role: 'ADMIN',
    },
    {
      email: 'admin@congregation.org',
      passwordPlain: 'Admin1234!',
      firstName: 'Père',
      lastName: 'Directeur',
      role: 'ADMIN',
    },
    {
      email: 'pere.thomas@congregation.org',
      passwordPlain: 'PereThomas1234!',
      firstName: 'Père',
      lastName: 'Thomas',
      role: 'LIBRARIAN',
    },
    {
      email: 'frere.joseph@congregation.org',
      passwordPlain: 'FrereJoseph1234!',
      firstName: 'Frère',
      lastName: 'Joseph',
      role: 'MEMBER',
    },
  ];

  for (const u of usersToSeed) {
    const hashedPassword = await bcrypt.hash(u.passwordPlain, 12);
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {
        password: hashedPassword,
        isActive: true,
        isEmailVerified: true,
        role: u.role,
      },
      create: {
        email: u.email,
        password: hashedPassword,
        firstName: u.firstName,
        lastName: u.lastName,
        role: u.role,
        isEmailVerified: true,
        isActive: true,
      },
    });
    console.log(`✅ Utilisateur créé/actualisé : ${user.email} (${u.role}) - MDP : ${u.passwordPlain}`);
  }

  // ─── Ouvrages d'exemple (catalogue de démonstration) ───────────────────────
  const categoryMap = Object.fromEntries(
    (await prisma.category.findMany()).map((c) => [c.slug, c.id])
  );

  const booksToSeed = [
    {
      isbn: '9782080701191', title: 'Les Confessions', author: 'Augustin d\'Hippone',
      publishingHouse: 'Flammarion', year: 1993, language: 'fr', pageCount: 452,
      location: 'TH-AUG-01', totalCopies: 2,
      summary: 'Récit autobiographique spirituel de saint Augustin, itinéraire d\'une âme vers Dieu.',
      tags: ['patristique', 'spiritualité', 'classique'], slugs: ['patristics', 'spirituality'],
    },
    {
      isbn: '9782204039122', title: 'Somme théologique', author: 'Thomas d\'Aquin',
      publishingHouse: 'Cerf', year: 1984, language: 'fr', pageCount: 1200,
      location: 'TH-AQU-01', totalCopies: 1,
      summary: 'Œuvre majeure de la théologie chrétienne médiévale, synthèse de la foi et de la raison.',
      tags: ['théologie', 'scolastique'], slugs: ['theology'],
    },
    {
      isbn: '9782283600347', title: 'Introduction à la vie dévote', author: 'François de Sales',
      publishingHouse: 'Le Seuil', year: 1962, language: 'fr', pageCount: 380,
      location: 'SP-SAL-01', totalCopies: 2,
      summary: 'Guide spirituel pour vivre la sainteté au quotidien, adressé à laïcs et religieux.',
      tags: ['spiritualité', 'ascétique'], slugs: ['spirituality'],
    },
    {
      isbn: '9782204071125', title: 'L\'Imitation de Jésus-Christ', author: 'Thomas a Kempis',
      publishingHouse: 'Cerf', year: 1990, language: 'fr', pageCount: 320,
      location: 'SP-KEM-01', totalCopies: 3,
      summary: 'Classique de la dévotion chrétienne, méditation sur la vie intérieure et le Christ.',
      tags: ['spiritualité', 'dévotion'], slugs: ['spirituality'],
    },
    {
      isbn: '9782226189348', title: 'Les Pères de l\'Église', author: 'Jean Daniélou',
      publishingHouse: 'Desclée de Brouwer', year: 2000, language: 'fr', pageCount: 512,
      location: 'PA-DAN-01', totalCopies: 1,
      summary: 'Introduction à la pensée et aux écrits des Pères de l\'Église des premiers siècles.',
      tags: ['patristique', 'histoire'], slugs: ['patristics', 'history'],
    },
    {
      isbn: '9782204078377', title: 'Le Nouveau Testament', author: 'École biblique de Jérusalem',
      publishingHouse: 'Cerf', year: 2014, language: 'fr', pageCount: 900,
      location: 'EC-BIJ-01', totalCopies: 4,
      summary: 'Traduction de la Bible de Jérusalem : évangiles, Actes, épîtres et Apocalypse.',
      tags: ['écriture', 'bible'], slugs: ['scripture'],
    },
    {
      isbn: '9782204080103', title: 'Constitution sur la sainte liturgie (Sacrosanctum Concilium)', author: 'Concile Vatican II',
      publishingHouse: 'Cerf', year: 1963, language: 'fr', pageCount: 120,
      location: 'LI-VAT-01', totalCopies: 2,
      summary: 'Texte conciliaire fondateur de la réforme liturgique du XXe siècle.',
      tags: ['liturgie', 'concile'], slugs: ['liturgy'],
    },
    {
      isbn: '9782718909295', title: 'Code de droit canonique', author: 'Jean-Paul II',
      publishingHouse: 'Pierre Téqui', year: 1983, language: 'fr', pageCount: 700,
      location: 'DC-CAN-01', totalCopies: 1,
      summary: 'Recueil des normes juridiques régissant l\'Église catholique latine.',
      tags: ['droit canon', 'juridique'], slugs: ['canon-law'],
    },
  ];

  for (const { slugs, ...bookData } of booksToSeed) {
    const book = await prisma.book.upsert({
      where: { isbn: bookData.isbn },
      update: { ...bookData, availableCopies: bookData.totalCopies },
      create: { ...bookData, availableCopies: bookData.totalCopies },
    });
    await prisma.bookCategory.deleteMany({ where: { bookId: book.id } });
    await prisma.bookCategory.createMany({
      data: slugs.map((slug) => ({ bookId: book.id, categoryId: categoryMap[slug] })).filter((x) => x.categoryId),
      skipDuplicates: true,
    });
  }
  console.log(`✅ ${booksToSeed.length} ouvrages d'exemple créés.`);

  console.log('\n🎉 Base de données initialisée avec succès.');
}

main()
  .catch((e) => { console.error('❌ Erreur seed:', e); process.exit(1); })
  .finally(() => prisma.$disconnect());
