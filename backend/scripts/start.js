#!/usr/bin/env node
/**
 * Démarrage en production (Render, etc.).
 *
 * Problème : sur Render, la commande de build par défaut (yarn/npm install)
 * ne crée JAMAIS les tables de la base de données. Résultat : l'erreur
 * « The table public.books does not exist in the current database ».
 *
 * Ce script applique le schéma Prisma (`prisma db push`) AVANT de lancer
 * le serveur, puis démarre server.js. `db push` est idempotent : si les
 * tables existent déjà, il ne fait rien.
 *
 * Si `db push` échoue (base injoignable, etc.), on démarre quand même le
 * serveur pour que le service ne parte pas en boucle de crash — mais un
 * message d'erreur explicite est affiché dans les logs.
 */
const path = require('path');
const { spawnSync } = require('child_process');

const backendDir = path.join(__dirname, '..');

// On se place dans backend/ pour que .env et le schéma Prisma soient trouvés.
try {
  process.chdir(backendDir);
} catch (_) {
  /* ignore */
}

// Localise le binaire Prisma installé dans node_modules (prisma est une
// dépendance de production pour être disponible sur Render).
function findPrismaBin() {
  const isWin = process.platform === 'win32';
  const bin = path.join(
    backendDir,
    'node_modules',
    '.bin',
    isWin ? 'prisma.cmd' : 'prisma'
  );
  return bin;
}

function runPrismaDbPush() {
  const bin = findPrismaBin();
  const args = ['db', 'push', '--skip-generate'];

  console.log('🔧 Application du schéma de base de données (prisma db push)...');
  const result = spawnSync(bin, args, {
    cwd: backendDir,
    stdio: 'inherit',
    shell: process.platform === 'win32',
    timeout: 180000, // 3 minutes max
    env: process.env,
  });

  if (result.error) {
    console.error('⚠️  Impossible de lancer prisma db push :', result.error.message);
    return false;
  }
  if (result.status !== 0) {
    console.error('⚠️  prisma db push a échoué (code ' + result.status + ').');
    console.error('   → Vérifie DATABASE_URL (base joignable depuis Internet ?).');
    return false;
  }
  console.log('✅ Schéma de base de données à jour.');
  return true;
}

try {
  runPrismaDbPush();
} catch (err) {
  console.error('⚠️  Erreur inattendue pendant prisma db push :', err.message);
}

// Démarre le serveur (le chargement de .env est fait dans server.js).
require(path.join(backendDir, 'server.js'));
