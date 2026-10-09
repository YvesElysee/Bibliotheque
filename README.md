# 📖 Bibliothèque de la Congrégation

Plateforme complète de gestion de bibliothèque conçue pour une communauté religieuse (congrégation de prêtres et religieux, dimensionnée pour ~40 utilisateurs).

---

## 🌟 Fonctionnalités Principales

### 1. Recherche & Consultation des Ouvrages
- **Recherche multicritère** : Titre, auteur, maison d'édition, éditeur scientifique, mot-clé / cote.
- **Recherche thématique** : Filtrage par catégories théologiques (Écriture Sainte, Patristique, Théologie Dogmatique & Morale, Liturgie, Philosophie, Spiritualité...).
- **Fiches descriptives complètes** : Couverture, résumé détaillé pour discerner l'intérêt de lecture, langue (FR, LA, EN, etc.), cote d'emplacement, nombre d'exemplaires et disponibilité en temps réel.

### 2. Circulation des Documents (Prêts & Restitutions)
- **Traçabilité totale** : Identité de l'emprunteur, date d'emprunt, date d'échéance de retour, historique des prolongations et date effective de restitution.
- **Gestion des retards** : Détection automatique des retards avec badges visuels d'alerte.
- **Espace membre « Mes Emprunts »** : Chaque prêtre ou religieux consulte ses emprunts en cours, le compte à rebours avant retour et peut solliciter une prolongation de 14 jours en un clic.

### 3. Espace « Signaler un Livre Indisponible »
- Espace dédié permettant aux membres de signaler un livre manquant ou recherché pour une session d'études, une homélie ou une recherche.
- Suivi du statut de la demande : *En attente*, *Approuvé (en commande)*, *Acquis (disponible)* ou *Non retenu*, avec notes d'information du bibliothécaire.

### 4. Ajout Rapide d'Ouvrages (Saisie Assistée par ISBN)
- **Auto-remplissage en un clic** : Saisie d'un code ISBN avec interrogation automatique des bases en ligne (*Google Books* & *Open Library*) pour pré-remplir le titre, l'auteur, l'éditeur, l'année, le résumé et la couverture haute définition.

### 5. Espace Administration & Développeur
- **Tableau de bord statistique** : Total d'ouvrages, emprunts actifs, retards, membres actifs, ouvrages les plus consultés et journal de bord en direct.
- **Gestion du catalogue** : Ajout, modification, archivage, recherche avancée et export de l'inventaire complet en PDF imprimable.
- **Gestion des catégories thématiques** : Création et personnalisation des couleurs d'accentuation.
- **Gestion des membres (~40 prêtres et étudiants)** : Attribution des rôles (*Membre*, *Bibliothécaire*, *Administrateur*) et activation/désactivation des comptes.
- **Journal d'audit** : Traçabilité des actions administratives (créations, suppressions, modifications de statut, adresses IP).

---

## 📂 Structure du Projet

```
bibliotheque-congregation/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma       # Modèle de base de données relationnelle PostgreSQL
│   │   └── seed.js             # Données initiales (catégories, admin, comptes tests)
│   ├── src/
│   │   ├── app.js              # Application Express & middlewares de sécurité
│   │   ├── config/             # Base de données Prisma & JWT
│   │   ├── middlewares/        # Authentification JWT, rôles, validation Joi, rate limiting
│   │   ├── modules/
│   │   │   ├── auth/           # Inscription, connexion, refresh tokens
│   │   │   ├── books/          # CRUD livres, filtres, recherche multicritère
│   │   │   ├── categories/     # Classification thématique
│   │   │   ├── loans/          # Prêts, retours, retards, prolongations
│   │   │   ├── requests/       # Livres indisponibles signalés
│   │   │   ├── reviews/        # Avis et notations de lecture
│   │   │   ├── users/          # Profils, gestion des membres, dashboard admin
│   │   │   └── exports/        # Génération d'inventaire PDF / CSV
│   │   └── utils/              # Réponses API standardisées, pagination, audit logger
│   ├── .env.example
│   ├── package.json
│   └── server.js
│
└── frontend/
    ├── css/
    │   ├── main.css            # Styles Tailwind & design system
    │   └── output.css          # Feuille de style compilée & autonome
    ├── js/
    │   ├── core/               # Client HTTP fetch api.js & gestion session auth.js
    │   ├── components/         # BookCard, Modales réutilisables, Toasts animés
    │   └── pages/
    │       ├── catalog.js      # Recherche, filtres thématiques, pagination, modal livre
    │       ├── login.js        # Authentification
    │       ├── register.js     # Inscription
    │       ├── requests.js     # Signalement des documents manquants
    │       ├── my-loans.js     # Suivi des prêts du membre connecté
    │       ├── profile.js      # Gestion du profil & mot de passe
    │       └── admin/
    │           └── dashboard.js# Contrôleur intégral de l'espace d'administration
    ├── pages/
    │   ├── index.html          # Page d'accueil & Catalogue
    │   ├── login.html          # Page de connexion
    │   ├── register.html       # Page d'inscription
    │   ├── requests.html       # Espace de signalement de livres indisponibles
    │   ├── my-loans.html       # Espace membre pour le suivi des emprunts
    │   ├── profile.html        # Mon profil
    │   └── admin/
    │       └── index.html      # Tableau de bord d'administration
    └── public/
        └── favicon.svg         # Favicon du projet
```

---

## 🚀 Démarrage Rapide

### Prérequis
- [Node.js](https://nodejs.org/) (version 18 ou supérieure)
- [PostgreSQL](https://www.postgresql.org/) (ou instance cloud Supabase / Neon / Docker)

### 1. Configuration du Backend

```bash
cd backend

# 1. Copier le fichier d'environnement
cp .env.example .env

# 2. Éditer .env pour configurer l'URL de votre base PostgreSQL :
# DATABASE_URL="postgresql://utilisateur:motdepasse@localhost:5432/bibliotheque_db?schema=public"

# 3. Installer les dépendances
npm install

# 4. Appliquer les migrations de la base de données
npx prisma migrate dev --name init

# 5. Peupler la base avec les catégories et comptes initiaux
node prisma/seed.js

# 6. Démarrer le serveur API
npm run dev
```

L'API démarre sur : **`http://localhost:3000`**

### 2. Démarrage du Frontend

Le frontend (HTML5 / JavaScript ES Modules / CSS compilé) est **servi directement par le backend Express**. Aucun second serveur n'est nécessaire : l'API et l'interface partagent la même origine (plus de problème CORS).

Une fois le backend démarré, ouvrez simplement :

- **Catalogue / site** : `http://localhost:3000/`
- **Connexion** : `http://localhost:3000/pages/login.html`
- **Administration** : `http://localhost:3000/pages/admin/index.html`

> Le mode développement avec Live Server reste possible (`npx live-server frontend --port=5500`) : le client HTTP détecte automatiquement le port 5500 et cible l'API sur `http://localhost:3000`.

Pour recompiler les styles Tailwind après une modification de `css/main.css` ou des classes utilisées :

```bash
cd frontend
npm install        # une seule fois
npm run build:css  # génère css/output.css
```

---

## ✉️ Configuration email (Gmail gratuit, optionnel)

Nécessaire uniquement pour envoyer la **vérification d'email** et les **liens de réinitialisation de mot de passe**. Solution 100 % gratuite.

1. Utilise (ou crée) un **compte Gmail** dédié, ex. `bibliotheque.congregation@gmail.com`.
2. Active la **validation en 2 étapes** : https://myaccount.google.com/security
3. Crée un **mot de passe d'application** (16 caractères, généré par Google) : https://myaccount.google.com/apppasswords
4. Renseigne-le dans `backend/.env` :
   ```env
   SMTP_USER=bibliotheque.congregation@gmail.com
   SMTP_PASS=xxxx xxxx xxxx xxxx   # mot de passe d'application (sans espaces si besoin)
   FRONTEND_URL=http://localhost:3000
   ```
5. Vérifie que tout fonctionne :
   ```bash
   cd backend
   npm run email:test     # envoie un email de test à ton adresse
   ```
6. (Optionnel) Pour exiger la vérification d'email à l'inscription, passe `REQUIRE_EMAIL_VERIFICATION=true` puis redémarre le serveur.

> Recommandation pour une petite congrégation : laisse la vérification d'email **désactivée** (inscription immédiate, moins de friction) et garde Gmail uniquement pour la **récupération de mot de passe**.

---

## 🔑 Identifiants Préconfigurés (Seed)

| Rôle | Email | Mot de passe |
| :--- | :--- | :--- |
| **Administrateur** | `admin@congregation.org` | `Admin1234!` |
| **Bibliothécaire** | `pere.thomas@congregation.org` | `PereThomas1234!` |
| **Membre** | `frere.joseph@congregation.org` | `FrereJoseph1234!` |

*(À modifier impérativement lors du premier déploiement en production via l'espace Mon Profil).*
