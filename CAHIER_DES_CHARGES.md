# 📋 CAHIER DES CHARGES

> **Instructions de remplissage**
> - Remplis chaque section. Si une section ne s'applique pas, écris `N/A` (ne la supprime pas).
> - Sois **précis et concret** : préfère des exemples à des phrases vagues.
> - Tu peux ajouter des sous-sections si nécessaire.
> - Plus c'est détaillé, mieux je code juste du premier coup.
> - Les zones `<!-- ... -->` sont des aides, tu peux les laisser ou les supprimer.

---

## 1. 🎯 OBJECTIF GÉNÉRAL

### 1.1 Que dois-je faire ?
<!-- En 1-3 phrases : qu'est-ce que tu veux que je code ? Une nouvelle feature ? Un fix ? Une refonte ? -->

```
Je veux que tu code une app de logistique qui mettra en relation une equipe de plusieurs personnes, possibilité de creer des "hub client" pour qu'il récupere leurs contenu, déposer des fichier vidéo, texte ect, possibilité d'éditer des fichier text. 
```

### 1.2 Pourquoi ? (le besoin métier)
<!-- Quel problème ça résout ? Pour qui ? -->

```
On place notre entreprise de production entre une entreprise et son média digital. on va créer les contenu et réaliser la production. pour ce fair on doit avoir une app qui permet a tout le monde d'étre parfaitement organiser. calendrier, notification de mission, ect tout en lien avec la production des contenu. 
```

### 1.3 Périmètre
- **Inclus dans la demande :**
  -
  -
- **Hors-périmètre (ne PAS toucher) :**
  -
  -

---

## 2. 🏗️ CONTEXTE TECHNIQUE DU PROJET

### 2.1 Stack choisie (PWA — installable sur iOS / Android / Desktop, sans store)

- **Frontend :** Next.js 15 (App Router) + TypeScript + React 19
- **Style :** Tailwind CSS + shadcn/ui
- **PWA :** `next-pwa` (manifest, service worker, offline cache, install prompt)
- **Backend :** Next.js Server Actions + Supabase
- **Base de données :** Supabase Postgres (avec RLS)
- **Auth :** Supabase Auth (email/password généré par le producteur) + WebAuthn (Face ID / Touch ID en re-login rapide)
- **Realtime :** Supabase Realtime (notifications missions en direct)
- **Push notifications :** Web Push API (compatible iOS 16.4+, Android, Desktop)
- **Stockage fichiers :** Supabase Storage (briefs, livrables, photos repérage)
- **Hébergement :** Vercel (frontend) + Supabase (backend)
- **Maps / géoloc :** à décider (Mapbox ou Google Maps)

### 2.2 Structure du projet
<!-- Arbo des dossiers importants + à quoi sert chacun.
Exemple :
src/
├── app/           → routes Next.js (App Router)
├── components/    → composants UI réutilisables
├── lib/           → utilitaires + clients (supabase, etc.)
├── context/       → React Context (auth, etc.)
└── ...
-->

```
aucune idée
```

### 2.3 Conventions de code à respecter
<!-- Nommage, patterns, style. Ex: "tous les composants en PascalCase", "pas de any en TS", "server components par défaut" -->

- 
-
-

---

## 3. 👥 INTERVENANTS / ACTEURS / RÔLES

<!-- Qui utilise le système ? Liste TOUS les rôles, même implicites (admin, client, livreur, système, cron, webhook externe...). -->

### Rôle 1 : `Producteur`
- **Description :** Dirigeant de la société
- **Permissions :** tout
- **Restrictions :** aucune
- **Authentification :** comme les autres mais avec ses propres identifiants

### Rôle 2 : `prestataire`
- **Description :** S'occupe de réaliser des mission envoyer par les producteurs
- **Permissions :** accepter ou refuser une mission 
- **Restrictions :** ne peux qu'avoir acces a son hub, nombre de mission réaliser, calendrier perso avec les missions a venir + info mission (localisation heure, ect...) 
- **Authentification :** comme les autres par un indentifiant et un mot de passe generer par nous. face id ou touche id...

### Rôle 2 : `client`
- **Description :** Récupère les fichier dans un hub dédier.
- **Permissions :** télécharger des fichier. 
- **Restrictions :** ne peux qu'avoir acces a son hub, 
- **Authentification :** comme les autres par un indentifiant et un mot de passe generer par nous. face id ou touche id...

<!-- Duplique autant que nécessaire -->

---

## 4. 🔄 COMMUNICATION ENTRE LES ACTEURS / MODULES

### 4.1 Flux principaux
<!-- Décris les interactions clés. Format suggéré : les producteur s'occupe de toute l'organisation, caler les tournage (lieux, duree, prix conditions ect..) 
les prestataires fonctionne comme l'app uber. en cas de mission il recoivent tous une notification (en fonction de leurs compétences exemple : cameraman, droniste...) le premier a accepter prend la mission. 


Exemple :
On a un contenu a tourner sur deux semaine, la prod encadre sur l'app toutes les infos, une fois l'organisation bouclé elle peut décider d'envoyer la mission au prestataire. eux valide ou rejette. 
-->



### 4.2 Mécanismes de communication
- [ ] API REST
- [ ] Server Actions (Next.js)
- [ ] WebSocket / Realtime (Supabase Realtime ?)
- [ ] Webhooks
- [ ] Email
- [ ] SMS / Push notif
- [ ] Cron / tâches planifiées
- [ ] Autre :

### 4.3 Événements asynchrones
<!-- Y a-t-il des actions différées ? Triggers BDD ? Edge Functions Supabase ? -->

```
aucune idée
```

---

## 5. 📐 RÈGLES MÉTIER

> **Important** : liste TOUTES les règles, même celles qui te paraissent évidentes. C'est ici que se cachent les bugs.

### 5.1 Règles de validation
<!-- Ex: "un email doit être unique", "une commande ne peut pas dépasser 50€ sans validation manager" -->

| # | Règle | Quand elle s'applique | Que faire si violée |
|---|-------|----------------------|---------------------|
| 1 | chaque role a un hub      | chaque intervenant doit se connecter et acceder a son espace personnaliser definie par son role (client, prestataire, admin, producteur)                     |                     |
| 2 |       |                      |                     |

### 5.2 Règles de workflow / états
<!-- Ex: une commande passe par : pending → confirmed → preparing → ready → delivered → archived
Indique les transitions AUTORISÉES et celles INTERDITES. -->

```
[État A] --action--> [État B]
[État B] --action--> [État C]
INTERDIT : [État C] --> [État A]
```

### 5.3 Règles de calcul
<!-- Formules, prix, taxes, remises, points de fidélité, etc. Donne des EXEMPLES CHIFFRÉS. -->

```
pas de vision pour l'instant
```

### 5.4 Règles de permissions / accès
<!-- Qui peut voir/modifier quoi ? RLS Supabase ? -->

```

```

### 5.5 Règles temporelles
<!-- Délais, expiration, horaires d'ouverture, fuseaux horaires -->

```
fuseau horaire de la martinique
```

---

## 6. ✨ FONCTIONNALITÉS DEMANDÉES

> Pour chaque feature, remplis le bloc complet.

### Feature 1 : `[NOM]`

**Description en 1 phrase :**
```

```

**User story :**
> En tant que `[rôle]`, je veux `[action]` afin de `[bénéfice]`.

**Critères d'acceptation (checklist testable) :**
- [ ]
- [ ]
- [ ]

**Cas limites / erreurs à gérer :**
-
-

**Maquette / inspiration (lien ou description UI) :**
```

```

---

### Feature 2 : `[NOM]`
<!-- Duplique le bloc ci-dessus -->

---

## 7. 🗃️ MODÈLE DE DONNÉES

### 7.1 Tables à créer / modifier
<!-- Pour chaque table : nom, colonnes (type + contraintes), relations -->

#### Table : `nom_table`
| Colonne | Type | Contrainte | Description |
|---------|------|-----------|-------------|
| id      | uuid | PK        |             |
|         |      |           |             |

**Relations :**
-

**RLS / policies Supabase :**
-

### 7.2 Migrations / données existantes
<!-- Y a-t-il des données existantes à migrer ? Backfill ? -->

```
[Détails]
```

---

## 8. 🎨 UI / UX

8. Stratégie UI / UX
Notre interface repose sur une esthétique "Futuriste Minimaliste", privilégiant la clarté spatiale, les contrastes profonds et des micro-interactions fluides pour une immersion totale.

🎨 Identité Visuelle (UI)
Thème : Principalement Dark Mode "Oled" (noir profond #000000) avec des surfaces en verre dépoli (Glassmorphism) pour créer de la profondeur.

Couleurs d'accent : Utilisation de dégradés néons (ex: Electric Blue vers Vibrant Violet) pour attirer l'attention sur les boutons d'action (CTA).

Typographie : Choix d'une police Sans-Serif géométrique et futuriste (ex: Inter, Space Grotesk ou Readex Pro). Fine pour le corps de texte, grasse et espacée pour les titres.

Iconographie : Utilisation d'icônes en Line-art fin (bibliothèques comme Lucide React ou Phosphor Icons) pour un aspect technique et propre.

✨ Expérience & Animations (UX)
Micro-interactions : Chaque clic déclenche un feedback visuel subtil (changement d'échelle, légère lueur).

Transitions fluides : Utilisation de la bibliothèque Framer Motion pour des entrées de page en fondu enchaîné et des éléments qui "glissent" à leur place.

Chargement Intelligent : Remplacement des spinners classiques par des Skeleton Screens (écrans fantômes) animés avec un effet de balayage lumineux.

📱 Adaptabilité
Responsive : Design conçu en Mobile-First, garantissant que les animations restent fluides même sur des processeurs mobiles plus limités.

Flou contextuel : Utilisation intensive du backdrop-filter: blur() pour maintenir la hiérarchie visuelle lors de l'ouverture de modales ou de menus.

🛠️ Stack technique suggérée (pour ton dev)
Pour obtenir ce rendu sans réinventer la roue, je te conseille d'utiliser :

Tailwind CSS (pour le design rapide et les utilitaires de flou).

Shadcn/ui (pour des composants de base ultra-propres).

Framer Motion (pour l'aspect "Apple-like" des animations).

Lucide React (pour les icônes).

### 8.1 Pages / écrans concernés
- `/route1` :
- `/route2` :

### 8.2 Composants à créer / modifier
-
-

### 8.3 Design system
<!-- Tailwind ? Shadcn ? Couleurs de marque ? Police ? -->

-

### 8.4 Responsive / mobile
- [ ] Mobile first
- [ ] Desktop adaptable 

### 8.5 Accessibilité
<!-- Niveau visé ? Contraintes spécifiques ? -->

```
[Réponse]
```

---

## 9. 🔌 INTÉGRATIONS EXTERNES

<!-- Stripe, Twilio, OpenAI, Google Maps, etc. -->

| Service | Usage | Clés/secrets dispo ? | Doc URL |
|---------|-------|----------------------|---------|
|         |       |                      |         |

---

## 10. 🧪 TESTS

- [ ] Tu veux que j'écrive des tests ? Quel framework ?
- [ ] Tests unitaires / intégration / e2e ?
- [ ] Cas critiques à couvrir absolument :
  -
  -

---

## 11. ⚠️ CONTRAINTES & PIÈGES CONNUS

### 11.1 Performances
<!-- Volume de données attendu, latence max, etc. -->

```

```

### 11.2 Sécurité
<!-- Données sensibles ? RGPD ? Auth obligatoire ? -->

```

```

### 11.3 Bugs/dette connus à NE PAS empirer
```

```

### 11.4 Choses qui m'ont déjà fait perdre du temps
<!-- Anti-patterns spécifiques à ce projet, gotchas Supabase, etc. -->

```

```

---

## 12. ✅ DÉFINITION DE "TERMINÉ"

<!-- Quand est-ce que je peux dire "c'est fait" ? -->

- [ ] Le code compile sans erreur
- [ ] La feature marche dans le happy path
- [ ] Les cas d'erreur sont gérés
- [ ] Les permissions/RLS sont en place
- [ ] (autre)

---

## 13. 📎 ANNEXES

### 13.1 Fichiers de référence à lire d'abord
<!-- Indique-moi les fichiers que je DOIS lire pour comprendre le contexte -->

-
-

### 13.2 Exemples concrets / scénarios
<!-- Donne 1-2 scénarios end-to-end avec des données réelles -->

**Scénario A :**
```
1. ...
2. ...
3. Résultat attendu : ...
```

### 13.3 Questions ouvertes / points à trancher
<!-- Choses dont tu n'es pas sûr et où tu veux mon avis -->

-
-

---

## 14. 🚦 PRIORITÉS

<!-- Si tu ne peux faire qu'une seule chose, ce serait laquelle ? Ordre P0 → P3 -->

| Priorité | Feature | Justif |
|----------|---------|--------|
| P0       |         |        |
| P1       |         |        |
| P2       |         |        |

---

> ✍️ **Une fois rempli, dis-moi simplement "c'est prêt" et je lis ce fichier puis je code.**
