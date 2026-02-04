# OMAS Externat

Plateforme de préparation aux examens de l'externat de médecine (EDN & ECOS) avec QCM hebdomadaires et corrections détaillées.

## 🎯 Projet Overview

**Nom**: OMAS Externat  
**Objectif**: Fournir aux étudiants en médecine une plateforme complète pour s'entraîner aux examens de l'externat avec des QCM hebdomadaires, des corrections détaillées et un suivi de progression.

**Fonctionnalités principales**:
- ✅ Système d'authentification avec rôles (étudiant/enseignant)
- ✅ QCM hebdomadaires par spécialité
- ✅ Interface de création de QCM avec saisie manuelle des réponses (ex: A ou A,C,D)
- ✅ Dashboard enseignant avec gestion des QCM
- ✅ Dashboard étudiant avec :
  - Stats globales (QCM complétés, score moyen, meilleure/faible matière)
  - Graphique radar interactif (performance par matière)
  - Historique des QCM complétés avec notes
- ✅ Publication/dépublication des QCM
- ✅ Support des questions à réponses multiples (checkboxes)
- ✅ Système de notation automatique avec page de résultats
- ✅ Enregistrement automatique des scores dans la BDD
- ✅ Menu déroulant du profil (évite déconnexion accidentelle)
- ✅ Corrections détaillées avec explications
- ✅ Interface responsive et moderne avec animations
- ✅ Base de données D1 pour stockage persistant

## 🌐 URLs

- **Développement Local**: https://3000-ipa4sb9eyfjfll38omhbm-82b888ba.sandbox.novita.ai
- **Production**: (À déployer sur Cloudflare Pages)
- **GitHub**: (À créer)

## 📊 Architecture de Données

### Modèles de Données

**Users (Utilisateurs)**:
- `id`: INTEGER (PRIMARY KEY)
- `email`: TEXT (UNIQUE)
- `password_hash`: TEXT
- `nom`: TEXT
- `prenom`: TEXT
- `created_at`: DATETIME
- `last_login`: DATETIME

**QCM Weekly (QCM Hebdomadaires)**:
- `id`: INTEGER (PRIMARY KEY)
- `titre`: TEXT
- `specialite`: TEXT (Cardiologie, Pneumologie, Neurologie, etc.)
- `semaine`: INTEGER
- `description`: TEXT
- `disponible_debut`: DATETIME
- `disponible_fin`: DATETIME
- `date_limite`: DATETIME

**Questions**:
- `id`: INTEGER (PRIMARY KEY)
- `qcm_id`: INTEGER (FOREIGN KEY)
- `enonce`: TEXT
- `option_a`, `option_b`, `option_c`, `option_d`, `option_e`: TEXT
- `question_type`: TEXT ('single' ou 'multiple')
- `reponse_correcte`: TEXT (pour questions simples, ex: 'A')
- `reponses_correctes`: TEXT (JSON array pour questions multiples, ex: '["A","C"]')
- `explication`: TEXT
- `ordre`: INTEGER

**Student Answers (Réponses des étudiants)**:
- `id`: INTEGER (PRIMARY KEY)
- `user_id`: INTEGER (FOREIGN KEY)
- `question_id`: INTEGER (FOREIGN KEY)
- `qcm_id`: INTEGER (FOREIGN KEY)
- `reponse`: TEXT
- `is_correct`: BOOLEAN
- `answered_at`: DATETIME

**Student Progress (Progression)**:
- `id`: INTEGER (PRIMARY KEY)
- `user_id`: INTEGER (FOREIGN KEY)
- `qcm_id`: INTEGER (FOREIGN KEY)
- `score`: REAL
- `total_questions`: INTEGER
- `correct_answers`: INTEGER
- `completed`: BOOLEAN
- `completed_at`: DATETIME

### Services de Stockage

- **Cloudflare D1**: Base de données SQLite distribuée pour toutes les données relationnelles
- **Mode Local**: Utilisation de `.wrangler/state/v3/d1` pour le développement
- **Mode Production**: Base de données D1 sur Cloudflare (nécessite configuration)

### Flux de Données

1. **Authentification**: User → API `/api/auth/login` → Validation → Token + User Info
2. **Liste QCM**: Frontend → API `/api/qcm/list` → D1 Database → JSON Response
3. **Détail QCM**: Frontend → API `/api/qcm/:id` → D1 Database → QCM + Questions
4. **Soumission Réponse**: Frontend → API `/api/qcm/:id/answer` → Validation → D1 Database

## 👥 Guide Utilisateur

### Pour les Étudiants

1. **Inscription**:
   - Accéder à la page de connexion
   - Cliquer sur l'onglet "Inscription"
   - Remplir le formulaire avec nom, prénom, email et mot de passe
   - Valider l'inscription

2. **Connexion**:
   - Utiliser votre email et mot de passe
   - Accéder à votre espace étudiant

3. **Accéder aux QCM**:
   - Cliquer sur "QH" dans le menu ou "Accéder aux QCM" sur la page d'accueil
   - Voir la liste des QCM hebdomadaires publiés
   - Cliquer sur "Répondre au QCM" pour commencer

4. **Répondre aux Questions**:
   - Lire l'énoncé de chaque question
   - **Questions à réponse unique**: Sélectionner UNE seule réponse (radio button)
   - **Questions à réponses multiples**: Cocher PLUSIEURS réponses (checkboxes) - badge violet visible
   - Cliquer sur "Valider et voir ma note" à la fin du QCM

5. **Consulter vos Résultats**:
   - Voir votre score global (X/Y) et pourcentage
   - Message contextuel selon votre performance :
     - < 50% : "Continuez à réviser !" (rouge)
     - 50-74% : "Bon travail, encore un effort !" (orange)
     - ≥ 75% : "Excellent travail !" (vert)
   - Détail par question avec votre réponse vs réponse correcte
   - Explications détaillées pour chaque question

6. **Consulter la FAQ**:
   - Cliquer sur "FAQ" dans le menu
   - Lire les questions fréquentes

### Comptes de Test

Pour tester l'application, vous pouvez utiliser ces comptes :

**Étudiant** :
- **Email**: etudiant1@exemple.fr  
  **Mot de passe**: password123

- **Email**: etudiant2@exemple.fr  
  **Mot de passe**: password123

**Enseignant** :
- **Email**: enseignant@exemple.fr  
  **Mot de passe**: password123

## 🚀 Déploiement

### Plateforme

- **Plateforme**: Cloudflare Pages
- **Runtime**: Cloudflare Workers
- **Framework**: Hono + TypeScript
- **Frontend**: HTML/CSS/JavaScript (CDN libraries)
- **Database**: Cloudflare D1 (SQLite)

### État du Déploiement

- ✅ **Développement Local**: Actif et fonctionnel
- 🚧 **Production Cloudflare**: En attente de configuration API key

### Stack Technique

- **Backend**: Hono 4.11.7
- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Build**: Vite 6.4.1
- **CLI**: Wrangler 4.4.0
- **Process Manager**: PM2 (développement local)
- **Frontend**: Vanilla JavaScript + TailwindCSS (CDN)
- **Icons**: Font Awesome 6.4.0

### Structure du Projet

```
webapp/
├── src/
│   ├── index.tsx           # Application Hono principale
│   └── renderer.tsx        # Renderer JSX
├── public/
│   └── static/
│       ├── styles.css      # Styles CSS
│       └── app.js          # JavaScript frontend
├── migrations/
│   └── 0001_initial_schema.sql  # Schema de base de données
├── ecosystem.config.cjs    # Configuration PM2
├── wrangler.jsonc          # Configuration Cloudflare
├── package.json            # Dépendances et scripts
├── seed.sql                # Données de test
├── .gitignore              # Fichiers ignorés par git
└── README.md               # Ce fichier
```

### Scripts Disponibles

```bash
# Développement
npm run dev              # Serveur Vite (local machine)
npm run dev:sandbox      # Wrangler pages dev (sandbox)
npm run dev:d1           # Avec base de données D1 locale

# Build & Déploiement
npm run build            # Build de production
npm run preview          # Prévisualisation du build
npm run deploy           # Déploiement sur Cloudflare Pages
npm run deploy:prod      # Déploiement production nommé

# Base de données
npm run db:migrate:local # Appliquer migrations (local)
npm run db:migrate:prod  # Appliquer migrations (prod)
npm run db:seed          # Charger données de test
npm run db:reset         # Reset et re-seed base locale
npm run db:console:local # Console SQL locale
npm run db:console:prod  # Console SQL production

# Utilitaires
npm run clean-port       # Libérer le port 3000
npm run test             # Tester si le serveur répond
npm run git:status       # Status git
npm run git:log          # Log git
```

### Déploiement sur Cloudflare Pages

**Prérequis**:
1. Compte Cloudflare
2. API Token Cloudflare (permissions: Pages, D1)
3. Appeler `setup_cloudflare_api_key` depuis l'environnement sandbox

**Étapes**:

```bash
# 1. Créer la base de données D1 de production
npx wrangler d1 create webapp-production

# 2. Copier le database_id dans wrangler.jsonc

# 3. Appliquer les migrations en production
npm run db:migrate:prod

# 4. Créer le projet Cloudflare Pages
npx wrangler pages project create webapp --production-branch main

# 5. Déployer l'application
npm run deploy:prod

# 6. (Optionnel) Configurer un domaine personnalisé
npx wrangler pages domain add example.com --project-name webapp
```

## 📝 Fonctionnalités Actuelles

### ✅ Complétées

1. **Page d'accueil**:
   - Hero section avec statistiques
   - Présentation des fonctionnalités
   - Navigation claire
   - Animations fluides

2. **Système d'authentification avec rôles**:
   - Formulaire de connexion/inscription avec sélection du rôle
   - Validation des données
   - Stockage des tokens (localStorage)
   - API REST pour login/register
   - Redirection automatique selon le rôle (étudiant/enseignant)

3. **Dashboard Enseignant**:
   - Liste des QCM créés par l'enseignant
   - Statut de publication (publié/brouillon)
   - Actions : Modifier, Publier/Dépublier, Supprimer
   - Navigation intuitive

4. **Interface de création de QCM**:
   - Formulaire intuitif pour les informations générales
   - Ajout dynamique de questions
   - Support de 4 ou 5 options de réponse
   - Champ explication pour chaque question
   - Gestion de la spécialité et des dates

5. **API Teacher**:
   - `GET /api/teacher/qcm/list/:teacherId` - Liste des QCM de l'enseignant
   - `POST /api/teacher/qcm/create` - Créer un nouveau QCM
   - `PUT /api/teacher/qcm/:id` - Modifier un QCM
   - `POST /api/teacher/qcm/:id/publish` - Publier/dépublier
   - `DELETE /api/teacher/qcm/:id` - Supprimer un QCM

6. **Page QCM Hebdomadaires**:
   - Liste des QCM publiés disponibles
   - Affichage par semaine et spécialité
   - Badges de statut (disponible/bientôt)
   - Dates de disponibilité et deadlines
   - Filtrage automatique (seulement QCM publiés)

7. **Page Détail QCM**:
   - Affichage des questions avec options multiples
   - Bouton "Voir la correction"
   - Affichage de la réponse correcte
   - Explications détaillées

8. **Page FAQ**:
   - Accordéon interactif
   - Questions fréquentes sur le fonctionnement

9. **Base de données**:
   - Schema complet avec migrations
   - Table users avec colonne role
   - Table qcm_weekly avec created_by et is_published
   - Données de test (3 QCM, multiple questions)
   - Relations entre tables
   - Indexes pour performance

### 🚧 En Cours / À Venir

1. **Espace Étudiant Personnalisé**:
   - Dashboard avec statistiques personnelles
   - Historique des QCM complétés
   - Graphiques de progression
   - Points forts/faibles par spécialité

2. **Système de Scoring**:
   - Calcul automatique du score
   - Enregistrement des réponses en temps réel
   - Validation des réponses
   - Pourcentage de réussite

3. **Édition de QCM par les enseignants**:
   - Formulaire de modification pré-rempli
   - Mise à jour des questions existantes
   - Interface intuitive similaire à la création

4. **Fonctionnalités Avancées**:
   - Réinitialisation de mot de passe
   - Profil utilisateur éditable
   - Notifications pour nouveaux QCM
   - Export des résultats PDF
   - Mode révision (replay des QCM)
   - Favoris et marque-pages

5. **Statistiques Enseignant**:
   - Nombre d'étudiants ayant complété chaque QCM
   - Taux de réussite par question
   - Questions les plus difficiles
   - Analytics détaillés

## 🔄 Prochaines Étapes Recommandées

### Court terme (Cette semaine)

1. **Implémenter le système de scoring**:
   - Soumettre les réponses en temps réel
   - Calculer et afficher le score final
   - Enregistrer dans `student_progress`

2. **Créer l'espace étudiant**:
   - Page `/espace-etudiant` avec dashboard
   - Afficher les QCM complétés
   - Statistiques de progression

3. **Améliorer la sécurité**:
   - Implémenter bcrypt pour les mots de passe
   - Générer de vrais JWT tokens
   - Middleware d'authentification

### Moyen terme (Ce mois)

1. **Déployer en production**:
   - Configurer l'API Cloudflare
   - Déployer sur Cloudflare Pages
   - Tester en conditions réelles

2. **Ajouter plus de QCM**:
   - Créer des QCM pour toutes les spécialités
   - Ajouter plus de questions par QCM
   - Varier les niveaux de difficulté

3. **Fonctionnalités utilisateur**:
   - Profil éditable
   - Réinitialisation mot de passe
   - Mode révision

### Long terme (Ce trimestre)

1. **Interface d'administration**:
   - Créer des QCM via interface web
   - Gérer les utilisateurs
   - Analytics et rapports

2. **Fonctionnalités avancées**:
   - Classement entre étudiants
   - Badges et récompenses
   - Mode compétition
   - Export PDF des résultats

3. **Mobile et PWA**:
   - Optimisation mobile
   - Progressive Web App
   - Notifications push

## 🐛 Problèmes Connus

- [ ] Les mots de passe sont stockés en clair (utiliser bcrypt en production)
- [ ] Les tokens sont basiques (implémenter JWT)
- [ ] Pas de validation d'email
- [ ] Pas de limitation de taux (rate limiting)

## 📚 Ressources

- [Documentation Hono](https://hono.dev/)
- [Cloudflare Workers](https://developers.cloudflare.com/workers/)
- [Cloudflare D1](https://developers.cloudflare.com/d1/)
- [TailwindCSS](https://tailwindcss.com/)

## 📄 Licence

© 2025 OMAS Externat. Tous droits réservés.

---

**Dernière mise à jour**: 2026-02-04  
**Version**: 1.0.0  
**Status**: ✅ Développement Local Actif | 🚧 Production En Attente
