# BusinessFlow AI

BusinessFlow AI est une application frontend de démonstration pour PME, réalisée avec HTML, CSS et JavaScript. Elle regroupe la gestion de tâches et d’entreprises, un espace membres, l’import de données ERP/CRM, les documents, des indicateurs locaux et une interface préparée pour un assistant IA.

## Démarrage

Ouvrir `index.html` dans un navigateur moderne ou lancer un serveur statique à la racine du projet :

```bash
npx serve .
```

Le serveur local est recommandé : Web Crypto et certaines fonctions navigateur peuvent être indisponibles depuis `file://`.

## Fonctions disponibles dans cette version

- Préférences de thème et de langue conservées dans `localStorage`. Français, anglais et arabe sont proposés ; l’arabe active RTL.
- Inscription, connexion, déconnexion, profil, rôles et gestion des membres dans le navigateur. Les mots de passe sont dérivés avec PBKDF2 via Web Crypto avant stockage.
- Données d’exemple fictives situées en Tunisie ; les indicateurs monétaires sont affichés en TND.
- Entreprises et tâches modifiables avec journal d’activité local.
- Imports CSV, JSON et XLSX parsés côté navigateur. Les métriques affichées reposent uniquement sur les colonnes détectées et ne remplacent pas une analyse métier.
- Documents PDF, DOCX, XLSX, CSV, JSON et TXT stockés dans IndexedDB. Le texte peut être extrait localement selon le format et la disponibilité du lecteur.
- Le tableau de bord montre des calculs locaux, des retards à partir des échéances et les documents récents. Le Business Health Score est une estimation heuristique, non un modèle prédictif.
- L’assistant répond localement avec des décomptes et extraits disponibles et indique ses limites ; ce n’est pas une IA connectée.

## Stockage et sécurité — limites importantes

Cette version n’est pas un SaaS sécurisé ni un système multi-tenant. Les comptes, rôles, sessions, données commerciales, préférences et journaux sont stockés dans le profil du navigateur, sans autorité serveur. Les contrôles de rôle côté JavaScript sont uniquement UX et peuvent être contournés ; ne pas y stocker de secrets ni de données personnelles ou sensibles. L’invitation crée un compte local et affiche un mot de passe temporaire : aucun courriel n’est envoyé. Une véritable authentification, autorisation, isolation d’entreprise, audit et gestion des secrets nécessitent un backend.

Les imports tabulaires sont gardés dans `localStorage` et limités à 8 Mo par fichier ; les documents sont gardés dans IndexedDB et limités à 25 Mo par fichier. Supprimer le stockage du navigateur efface ces données. N’utiliser que des jeux de données fictifs ou non sensibles dans cette démo.

## API et dépendances

`js/api.js` décrit les interfaces préparées :

- `POST /api/ai/chat`
- `POST /api/analytics/analyze`
- `POST /api/documents` (progression d’envoi)
- `GET /api/documents/:id`, `DELETE /api/documents/:id`
- `POST /api/ai/documents/:id/analyze`
- `POST /api/ai/documents/:id/summary`

`API_ENABLED` est `false` : aucune de ces routes n’est appelée par défaut et aucun résultat IA serveur n’est revendiqué. La mise en production nécessite un backend qui authentifie et autorise chaque requête, valide les fichiers, isole les espaces de travail, stocke les documents et appelle le fournisseur IA sans exposer de clé côté navigateur.

La lecture XLSX, PDF et DOCX utilise SheetJS, PDF.js et Mammoth servis par CDN dans `pages/data.html`. L’accès réseau au CDN peut être requis selon le cache du navigateur. Les documents restent dans le navigateur ; les librairies de lecture externes ne reçoivent pas les fichiers via une requête d’upload.

## Fichiers principaux

- `js/storage.js`, `js/auth-service.js`, `js/members.js` : stockage local, session, rôles et membres.
- `js/data-parser.js`, `js/data.js`, `js/documents-store.js`, `js/documents.js` : import, analyse élémentaire et persistance locale des fichiers.
- `js/dashboard.js`, `js/analytics.js`, `js/ai-assistant.js`, `js/api.js` : affichage et interfaces d’analyse/IA.
- `js/i18n/fr.js`, `js/i18n/en.js`, `js/i18n/ar.js` : dictionnaires de langue.
- `css/style.css`, `css/components.css`, `css/dashboard.css`, `css/responsive.css` : thèmes, composants et présentation responsive.
