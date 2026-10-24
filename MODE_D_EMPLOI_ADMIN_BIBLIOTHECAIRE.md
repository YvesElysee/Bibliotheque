# MODE D'EMPLOI - Administrateur & Bibliothécaire
**Public :** Administrateurs (ADMIN) et Bibliothécaires (LIBRARIAN)  
**Site en ligne :** https://bibliotheque-a4sw.onrender.com/  
**Accès :** https://bibliotheque-a4sw.onrender.com/pages/admin/index.html  
**Version :** Octobre 2026

## 1. Description

L'espace d'administration permet de gérer intégralement la bibliothèque : catalogue, membres, emprunts, retours, réservations, relances, messages et statistiques.

## 2. Objectifs

- Gérer le fonds documentaire (ajout, modification, import)
- Enregistrer les emprunts et les retours
- Gérer les membres et leurs droits
- Assurer le suivi des retards et relances
- Traiter les demandes de contact
- Suivre l'activité de la bibliothèque

## 3. Connexion

1. Allez sur [https://bibliotheque-a4sw.onrender.com/pages/login.html](https://bibliotheque-a4sw.onrender.com/pages/login.html)
2. Connectez-vous avec vos identifiants administrateur/bibliothécaire
3. Cliquez sur **« Administration »** dans le menu ou accédez directement à l'interface admin

**Différence des rôles :**
- **BIBLIOTHÉCAIRE** : Gère le catalogue, emprunts/retours, relances, messages
- **ADMINISTRATEUR** : Accès complet + gestion des utilisateurs + journal d'audit + suppression

## 4. Présentation de l'interface

Le menu latéral regroupe les rubriques :
- **Tableau de bord** – Vue d'ensemble et statistiques
- **Catalogue** – Livres et Catégories
- **Circulation** – Emprunts et Relances
- **Livres signalés** – Demandes de livres
- **Messages** – Messages visiteurs (avec pastille si non lus)
- **Administration** – Utilisateurs et Journal d'activité
- **Thème** – Basculer clair/sombre en bas du menu

## 5. Gestion du catalogue

### 5.1 Ajouter un livre manuellement
1. **Administration → Livres → Ajouter un livre**
2. Renseignez au minimum : Titre, Auteur
3. Complétez : ISBN, Année, Éditeur, Langue, Emplacement (cote), Nombre d'exemplaires
4. Ajoutez une couverture (upload) ou laissez vide
5. Enregistrez

### 5.2 Importer depuis ISBN
1. **Ajouter un livre → Rechercher par ISBN**
2. Saisissez l'ISBN et cliquez sur « Rechercher »
3. Les informations se remplissent automatiquement depuis Google Books/OpenLibrary
4. Vérifiez et enregistrez

### 5.3 Générer un résumé IA
Dans le formulaire d'ajout/modification d'un livre, utilisez le bouton **« Résumé IA »** pour générer automatiquement un résumé à partir du titre/auteur.

### 5.4 Catégories
**Administration → Catégories** : Créer, modifier ou supprimer les catégories (Théologie, Spiritualité, Histoire, etc.)

## 6. Gestion des emprunts et retours

### 6.1 Enregistrer un emprunt
1. **Administration → Emprunts → Nouvel emprunt**
2. Recherchez le **membre** (par nom/email)
3. Recherchez le **livre** (par titre/auteur)
4. **Durée de l'emprunt** : Choisissez 7, 14, 21, 30 jours ou **« Personnalisée »** et saisissez le nombre de jours souhaité
5. La **date de retour** se calcule automatiquement
6. Validez l'emprunt

### 6.2 Enregistrer un retour
1. **Administration → Emprunts**
2. Trouvez l'emprunt en cours (filtrez par « En cours » ou repérez les pastilles « En retard » / « À rendre aujourd'hui »)
3. Cliquez sur **« Retourner »**
4. Confirmez le retour

### 6.3 Prolonger un emprunt
Depuis la fiche de l'emprunt ou depuis l'espace concerné, utilisez **« Prolonger »** selon les règles en vigueur.

### 6.4 Repérage visuel
Dans l'onglet **Emprunts**, les échéances sont mises en évidence :
- **Rouge (En retard)** – Dépassé
- **Orange (Bientôt dû)** – Dans les 3 jours
- **Bleu/Neutre (À venir)** – Plus éloigné

## 7. Liste d'attente (réservations)

1. **Administration → Livres → [Fiche du livre]** ou consultez les réservations
2. Vous voyez la liste ordonnée par **ordre d'arrivée** (premier arrivé, premier servi)
3. Quand un livre redevient disponible, le premier dans la file est prioritaire
4. Le membre voit son rang exact dans son espace « Mes réservations »

## 8. Relances des emprunts

**Administration → Relances**
- **En retard** : Emprunts dont la date de retour est dépassée
- **Retours à venir** : Emprunts arrivant à échéance (configurable : 1, 3, 5 ou 7 jours avant)
- **Bouton WhatsApp** : Ouvre WhatsApp avec un message pré-rempli (nécessite que le membre ait renseigné son numéro dans son profil)
- **Bouton Copier** : Copie le message pour envoi manuel

## 9. Messages visiteurs

**Administration → Messages** (pastille rouge = non lus)
1. Cliquez sur un message dans la liste de gauche
2. Le message s'ouvre à droite avec : expéditeur, email, téléphone, sujet, date, contenu
3. **Marquer comme lu / non lu** selon votre traitement
4. **Supprimer** si nécessaire (réservé aux administrateurs)

Les visiteurs envoient ces messages via le formulaire **« Contacter l'administration »** présent dans le pied de page du site public.

## 10. Gestion des membres

**Administration → Utilisateurs**
- Consulter la liste, filtrer/rechercher
- Modifier le rôle (**Membre / Bibliothécaire / Administrateur**)
- Activer/Désactiver un compte
- Consulter l'historique des emprunts du membre

## 11. Exports & QR Codes

**Administration → Livres** ou via les actions :
- **Inventaire PDF** : Liste complète des ouvrages
- **Étiquettes QR** : À imprimer et coller sur les livres. Le QR code renvoie directement vers la fiche du livre sur le site
- **Fiche d'emprunt PDF** : Pour impression

## 12. Configuration IA (Gemini) - 3 clés gratuites

Pour activer le **« Résumé IA »** à la demande (visiteurs + admin), configurez jusqu'à 3 clés gratuites Gemini.

### Étape 1 : Obtenir les clés
1. Allez sur [https://aistudio.google.com/apikey](https://aistudio.google.com/apikey)
2. Connectez-vous avec un compte Google
3. Cliquez **« Create API key »** → Créez-en **3** (différents projets/comptes si besoin)
4. Copiez chaque clé

### Étape 2 : Configurer sur Render
1. Ouvrez [https://dashboard.render.com/](https://dashboard.render.com/) → Votre service `bibliotheque-a4sw`
2. Allez dans **Environment → Add Environment Variable**
3. Ajoutez ces variables **exactement** comme indiqué :

| Clé | Valeur | Obligatoire |
|---|---|---|
| `GEMINI_API_KEY_1` | `votre_premiere_cle_gemini` | **Oui** (minimum 1) |
| `GEMINI_API_KEY_2` | `votre_deuxieme_cle_gemini` | Recommandé (rotation) |
| `GEMINI_API_KEY_3` | `votre_troisieme_cle_gemini` | Recommandé (rotation) |
| `GEMINI_MODEL` | `gemini-2.5-flash` | Optionnel (défaut utilisé) |

**Astuce rotation :** Si une clé atteint son quota gratuit, le système essaie automatiquement la suivante. Avec 3 clés, vous couvrez largement l'usage normal.

### Étape 3 : Appliquer
1. Cliquez **« Save Changes »**
2. Render redémarre automatiquement le service (1-2 minutes)
3. Testez depuis une fiche livre → **« Résumé IA »**

### Vérification locale (.env)
Dans `backend/.env` (développement) :
```env
GEMINI_API_KEY_1=AIza...
GEMINI_API_KEY_2=AIza...
GEMINI_API_KEY_3=AIza...
GEMINI_MODEL=gemini-2.5-flash
```

## 13. Astuces rapides
- **Mode clair/sombre** : Disponible en haut (navbar) et en bas du menu admin
- **Thème mémorisé** : Votre choix est conservé sur cet appareil
- **Mobile** : Menu latéral admin accessible via le bouton burger
- **Messages non lus** : Pastille rouge sur « Messages » dans le menu admin
- **Relances** : Utilisez l'écran « Relances » pour gagner du temps (WhatsApp + copie)

**Support technique :** Mballa Yves Elysee – +237 6 53 81 47 76 – [https://wa.me/237653814776](https://wa.me/237653814776)
