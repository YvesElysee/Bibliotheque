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

  // ─── Ouvrages d'exemple : DÉSACTIVÉS ───────────────────────────────────────
  // La bibliothèque réelle (136 livres) est importée automatiquement par
  // src/utils/ensureBooks.js au démarrage : inutile de créer des livres de
  // démonstration ici.

  console.log('\n🎉 Base de données initialisée avec succès.');
}

if (require.main === module) {
  main()
    .catch((e) => { console.error('❌ Erreur seed:', e); process.exit(1); })
    .finally(() => prisma.$disconnect());
}

module.exports = { main };
