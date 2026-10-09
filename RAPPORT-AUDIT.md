# Rapport d'audit & de mise en service — Bibliothèque de la Congrégation

Date : 9 octobre 2026
Périmètre : application de gestion de bibliothèque (backend Node/Express + Prisma/PostgreSQL, frontend HTML/JS/CSS servi par le backend).

---

## 1. Résumé

L'application était fonctionnelle sur le papier mais présentait plusieurs bugs bloquants (catalogue admin vide, création de livres/emprunts impossible, nouveaux comptes verrouillés) ainsi qu'une architecture d'exécution trop lourde pour l'usage cible (~40 utilisateurs).

**Résultat** : tous les bugs bloquants identifiés ont été corrigés, l'application se lance désormais **avec un seul serveur** (`http://localhost:3000`) et le catalogue est pré-rempli de 8 ouvrages d'exemple.

---

## 2. Corrections apportées

### 2.1 Bugs bloquants (empêchaient l'usage)

| # | Problème | Cause | Correction |
|---|----------|-------|------------|
| 1 | Toutes les listes de l'admin (livres, emprunts, membres, journal) étaient vides | Le front lisait `res.data.items` alors que l'API renvoie `res.data` (tableau) + `res.meta` | Dashboard corrigé pour utiliser `res.data` / `res.meta` |
| 2 | Tri admin `sort=updatedAt` renvoyait une erreur 400 | L'enum de tri du schéma ne connaissait pas `updatedAt` | `updatedAt` ajouté à l'enum |
| 3 | Création/modification de livre impossible | Le front envoie `null` pour les champs vides, refusés par zod (`.optional()`) | Champs passés en `.nullish()` (accepte `null`) |
| 4 | Création de catégorie impossible | `slug` obligatoire non envoyé par le front | Le backend génère automatiquement le `slug` depuis `nameFr` ; `nameEn` devient optionnel |
| 5 | Enregistrement d'un emprunt impossible | Le front envoie `dueDate`, le contrôleur attendait `dueDateOverride` (format datetime strict) | `dueDate`/`dueDateOverride` acceptés et normalisés |
| 6 | Les signalements de livres ne s'affichaient pas / mauvais statuts | Le front utilisait `notes` et les statuts `APPROVED/PURCHASED/REJECTED` ; l'API utilise `description` et `OPEN/IN_PROGRESS/ACQUIRED/CLOSED` | Front aligné sur le modèle de données |
| 7 | Nouveaux inscrits ne pouvaient jamais se connecter | Vérification d'email obligatoire mais SMTP non configuré + pages manquantes | Vérification rendue **optionnelle** (`REQUIRE_EMAIL_VERIFICATION`, désactivée par défaut) ; les pages manquantes ont été créées |
| 8 | Compteur « N en attente » toujours à 0 sur les cartes | `_count.reservations` absent de la requête | Ajouté au `BOOK_SELECT` |

### 2.2 Allègement & performance

- **Suppression du CDN Tailwind** (`cdn.tailwindcss.com`) sur les 7 pages : le CSS compilé local (`css/output.css`) suffit, plus de dépendance réseau externe.
- **Suppression de la police Google Fonts** distante : rendu via polices système (site 100 % autonome / hors-ligne).
- **Dépendances inutiles retirées** du backend : `multer` et `sharp` (la fonction d'upload de couverture n'était pas branchée).
- **Client HTTP** : URL d'API rendue dynamique (même origine par défaut) au lieu de `http://localhost:3000` codé en dur.
- **Résolution des couvertures** centralisée via `resolveAssetUrl()`.

### 2.3 Sécurité & cohérence

- `JWT_SECRET` : valeur aléatoire de 96 caractères générée (l'ancienne était un placeholder).
- Liste des langues du profil limitée à **FR / EN** pour correspondre à l'énumération en base (choisir « Latin » provoquait une erreur 500).
- Recherche utilisateur/livre dans le formulaire d'emprunt admin corrigée (elle lisait un mauvais chemin de données).

---

## 3. Hébergement (mise en service)

L'application tourne sur **un seul processus** : Express sert à la fois l'API (`/api/...`) et les fichiers du site. Cela supprime CORS et le double serveur.

### Démarrer

```bash
cd backend
npm run dev        # démarre l'API + le site sur http://localhost:3000
# (ou : npm start pour un démarrage sans surveillance de fichiers)
```

### Accès

| Espace | URL |
|--------|-----|
| Catalogue / accueil | http://localhost:3000/ |
| Connexion | http://localhost:3000/pages/login.html |
| Inscription | http://localhost:3000/pages/register.html |
| Administration | http://localhost:3000/pages/admin/index.html |
| API – état | http://localhost:3000/api/health |

### Arrêter

- Si lancé au premier plan : `Ctrl+C` dans le terminal.
- Si lancé en arrière-plan : `pkill -f "server.js"`.

### Ouvrir aux autres membres du réseau local

Par défaut le serveur écoute sur le port 3000 de la machine. Pour qu'il soit joignable par les autres postes du couvent/réseau, démarrez-le en écoutant sur toutes les interfaces et communiquez l'adresse IP locale du serveur (`hostname -I`) :

```bash
PORT=3000 HOST=0.0.0.0 npm run dev
# puis, depuis un autre poste : http://<IP-DU-SERVEUR>:3000/
```

> Vérifiez dans ce cas que `FRONTEND_URL` dans `backend/.env` correspond à l'adresse utilisée (utile pour les liens des emails).

### Mise en production (recommandations)

- Utiliser `npm start` (sans nodemon) derrière un gestionnaire de processus (`pm2` : `pm2 start server.js --name biblio`).
- Configurer un vrai `JWT_SECRET` et des identifiants PostgreSQL solides dans `backend/.env`.
- Sauvegarder régulièrement la base (`pg_dump bibliotheque_db`).
- Pour activer la vérification d'email : renseigner le SMTP puis `REQUIRE_EMAIL_VERIFICATION=true`.

---

## 4. Comptes & rôles

Trois rôles existent, du plus restreint au plus large :

| Rôle | Peut faire |
|------|-----------|
| **MEMBER** (membre / prêtre / religieux) | Consulter le catalogue, réserver un livre indisponible, suivre ses emprunts, signaler un livre manquant, gérer son profil |
| **LIBRARIAN** (bibliothécaire) | Tout ce que fait un membre **+** enregistrer les emprunts/retours, gérer livres et catégories, traiter les signalements, accéder au tableau de bord |
| **ADMIN** (administrateur) | Tout ce que fait un bibliothécaire **+** gérer les membres et leurs rôles, activer/désactiver des comptes, consulter le journal d'audit, archiver/supprimer des livres |

> Remarque : l'emprunt n'est pas auto-service. Un membre ne peut pas s'emprunter un livre lui-même ; il le **réserve** (file d'attente) ou contacte le bibliothécaire qui enregistre l'emprunt depuis l'administration. C'est cohérent avec l'usage d'une bibliothèque de congrégation.

### Comptes créés par le seed

| Rôle | Email | Mot de passe |
|------|-------|--------------|
| Administrateur | `admin@congregation.org` | `Admin1234!` |
| Bibliothécaire | `pere.thomas@congregation.org` | `PereThomas1234!` |
| Membre | `frere.joseph@congregation.org` | `FrereJoseph1234!` |

*(Un second compte admin technique existe : `admin@bibliotheque.local` / `Admin@Biblio2024!`.)*

**Changez ces mots de passe avant tout usage réel** (espace « Mon Profil » pour l'utilisateur, gestion des membres pour l'admin).

### Créer les 40 accès

Deux possibilités :
1. **Auto-inscription** : chaque membre crée son compte depuis `/pages/register.html` (activé immédiatement, vérification email désactivée).
2. **Création par l'admin** : depuis Administration → Membres, puis ajustement du rôle (Membre / Bibliothécaire / Administrateur).

---

## 5. Données de démonstration

Le seed contient désormais 10 catégories thématiques et **8 ouvrages d'exemple** (Augustin, Thomas d'Aquin, François de Sales, etc.) pour que le catalogue et les tableaux de bord ne soient pas vides. Un emprunt et un signalement de démonstration sont également présents.

> Ces ouvrages sont des **exemples** (ISBN de démonstration) : supprimez-les ou remplacez-les par le fonds réel via l'administration.

---

## 6. Points restants / recommandations

- **Saisie assistée par ISBN** : elle interroge actuellement les API externes Google Books / Open Library. Fonctionnalité pratique mais dépendante d'Internet ; à vérifier si le serveur est hors-ligne.
- **Notifications par email** : inactives tant que le SMTP n'est pas configuré. Solution retenue : **Gmail gratuit** (mot de passe d'application), sans frais. Configuration détaillée dans le `README.md` (section « Configuration email ») et testable via `npm run email:test`. La vérification d'email peut rester désactivée ; Gmail sert surtout à la récupération de mot de passe.
- **Multilingue** : le bouton de langue (FR/EN) de la barre de navigation n'est pas encore implémenté (le contenu reste en français).
- **Sauvegardes** : à mettre en place côté PostgreSQL.
- **Tests** : aucun test automatisé n'existe ; un jeu de tests API serait utile avant montée en charge.
