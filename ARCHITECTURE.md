# 🏛️ LUMEN — Architecture technique

> **Doc vivante.** À mettre à jour à chaque fois qu'on ajoute une feature, qu'on change une convention ou qu'on identifie un piège. Le `CAHIER_DES_CHARGES.md` décrit le **quoi/pourquoi** (côté métier), ce fichier décrit le **comment** (côté tech).

---

## 1. Stack

| Couche | Choix | Version |
|--------|-------|---------|
| Framework | Next.js (App Router, React Compiler, Turbopack) | 16.2.6 |
| Langage | TypeScript | 5.x |
| React | React 19 (Server Components, `useActionState`) | 19.2.4 |
| UI components | shadcn/ui (Radix-based) | latest |
| Styles | Tailwind CSS v4 (`@theme inline`, pas de `tailwind.config.ts`) | 4.x |
| Animations | `motion` (anciennement Framer Motion) | 12.x |
| Icônes | `lucide-react` | 1.x |
| Fonts | Inter (corps) + Space Grotesk (titres) via `next/font/google` | — |
| Auth | Supabase Auth (email/password, créés par admin) | — |
| Base de données | Supabase Postgres + Row Level Security | Postgres 17 |
| Realtime | Supabase Realtime (à venir P4) | — |
| Storage | Supabase Storage (à venir P3) | — |
| Hébergement | Vercel (front) + Supabase (back) — pas encore déployé | — |

### Convention Next.js 16 — ⚠️ piège
- **Le fichier de proxy s'appelle `src/proxy.ts`**, plus `middleware.ts`. La fonction exportée s'appelle `proxy()`, plus `middleware()`. Toute doc/training antérieure à fin 2025 est obsolète sur ce point. Voir `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md`.

---

## 2. Structure des dossiers

```
prod/
├── ARCHITECTURE.md           ← Tu es ici
├── CAHIER_DES_CHARGES.md     ← Spec métier
├── CLAUDE.md / AGENTS.md     ← Instructions agents AI
├── README.md
├── package.json              ← scripts: dev / build / start / lint / seed
├── next.config.ts            ← React Compiler activé
├── tsconfig.json
├── eslint.config.mjs
├── postcss.config.mjs
├── components.json           ← config shadcn
├── .env.local                ← gitignoré (URL Supabase + keys)
├── db/
│   ├── schema.sql            ← Schéma complet + RLS + grants + seed skills
│   └── grants.sql            ← Patch grants seul (utile si on touche aux perms)
├── scripts/
│   └── seed.mjs              ← `npm run seed` : crée 3 comptes de test
├── public/
└── src/
    ├── proxy.ts              ← Session refresh + route protection
    ├── app/
    │   ├── layout.tsx        ← <html lang="fr" class="dark"> + fonts
    │   ├── page.tsx          ← Server Component, redirige vers /<role>
    │   ├── globals.css       ← Variables CSS + utilities glass/neon
    │   ├── login/
    │   │   ├── page.tsx       (Server: decor + form)
    │   │   ├── login-form.tsx (Client: useActionState)
    │   │   └── actions.ts     (Server action: signIn)
    │   ├── producteur/        (dashboards + pages spécifiques au rôle)
    │   ├── prestataire/
    │   ├── client/
    │   └── actions/
    │       └── auth.ts        (signOut)
    ├── components/
    │   ├── ui/               ← shadcn (button, card, input, label, dialog, …)
    │   ├── dashboard/        ← shell, stat-card, nav, …
    │   └── background-orbs.tsx
    └── lib/
        ├── utils.ts          ← cn() de shadcn
        └── supabase/
            ├── client.ts     ← browser client (publishable key)
            ├── server.ts     ← server client (gère cookies)
            ├── admin.ts      ← admin client (secret key, server only)
            └── middleware.ts ← helper updateSession() utilisé par proxy.ts
```

---

## 3. Conventions de code

### TypeScript
- `strict: true` (héritage `tsconfig` Next 16).
- Pas de `any` non motivé. Si nécessaire, `// eslint-disable-next-line` + commentaire.
- Types Supabase non générés pour l'instant — à terme : `supabase gen types typescript`.

### Composants
- **Server Components par défaut.** N'ajoute `"use client"` que si :
  - tu utilises un hook React (`useState`, `useActionState`, `useEffect`…),
  - tu utilises `motion/react` ou un événement DOM,
  - tu importes un autre composant client qui en dépend (transitivement).
- Composants client = noms en `kebab-case-fichier.tsx`, fonction en PascalCase.
- Server actions = fichiers `actions.ts` dans le dossier de la route concernée, avec `"use server"` en tête.

### Styles
- **Pas de CSS séparé**. Tout en classes Tailwind, ou via les utilities custom de `globals.css` (`.glass-panel`, `.text-gradient-neon`, `.bg-gradient-neon`, `.font-heading`).
- Palette OLED : `bg-background` (noir #000), `text-foreground` (blanc cassé), `text-muted-foreground` (gris).
- Accents : `--primary` (bleu électrique 258°) et `--accent` (violet 310°).
- Pour un **glow** sur un CTA : `bg-gradient-neon` + `shadow-[0_10px_40px_-10px_oklch(0.6_0.25_278/0.6)]`.

### Routing
- `/` → Server Component qui redirige vers `/producteur`, `/prestataire` ou `/client` selon `profile.role`.
- `/login` → page publique (whitelistée dans `proxy.ts`).
- Tout autre chemin → `proxy.ts` exige une session, sinon redirige vers `/login?next=<chemin>`.
- Chaque page de dashboard **revalide** elle-même le rôle attendu (defense in depth) en début de Server Component.

### Naming des routes
- Routes admin du producteur : `/producteur/<feature>` (ex: `/producteur/equipe`, `/producteur/competences`, `/producteur/projets`).
- Routes prestataire : `/prestataire/<feature>`.
- Routes client : `/client/<feature>`.

---

## 4. Couche données (Supabase)

### Tables (cf. `db/schema.sql` pour les colonnes)

| Table | Propriétaire | Notes |
|-------|-------------|-------|
| `profiles` | Tous | Étend `auth.users`. Contient `role`, nom/prénom, `banned_until` |
| `prestataire_profiles` | Prestataire | Données sensibles : RIB, contact urgence — table séparée pour RLS stricte |
| `skills` | Producteur | Liste éditable (CRUD producteur). Seed : 7 skills par défaut |
| `user_skills` | Producteur | M:N entre profiles et skills |
| `projects` | Producteur | Dossier (1 client_id par projet, nullable). Visibilité contrôlée par `project_producteurs` |
| `project_producteurs` | M:N | Lie un projet aux N producteurs qui le gèrent. **Filtre principal** des projets côté producteur |
| `episodes` | Producteur | N émissions par projet. Champs prod enrichis : `status` (workflow enum), `format`, `production_date` + `production_time` + `duration_minutes`, `publication_date`, `location`, `guests` (jsonb), `equipment` (jsonb), `platforms` (jsonb array of strings), `notes` |
| `platforms` | Producteur | Référentiel global des plateformes de diffusion (YouTube, TF1, …). CRUDable. Episodes les référencent par nom dans le jsonb `platforms` |
| `missions` | Producteur (CRUD) + prestataires (accept/cancel) | Cœur métier, voir §5 |
| `files` | Mixte (cf. RLS) | Path Supabase Storage tracké ici. `target` enum définit le contexte |
| `text_documents` | Producteur (CRUD) | Stocke JSON Tiptap. Édition temps réel = post-MVP |
| `notifications` | Système | In-app uniquement pour l'instant |
| `client_profiles` | Producteur (CRUD) + client (read self) | Infos étendues côté client : raison sociale, adresse de facturation, SIRET, n° TVA, téléphone, contact… Sert au bloc « Client » des factures PDF. Pattern miroir de `prestataire_profiles` |
| `invoices` | Producteur (CRUD) + client (SELECT non-draft) | En-tête facture : `number` auto (LUM-YYYY-NNN), `status` (draft/sent/paid/overdue/cancelled), dates, totaux HT/TVA/TTC, `studio_snapshot` + `client_snapshot` (figés à émission, refresh sur update tant que draft) |
| `invoice_lines` | Mêmes droits que `invoices` | Lignes : description, qty, PU HT, taux TVA, totaux dérivés |
| `meeting_reports` | Producteur (CRUD) | Comptes-rendus de réunion générés par Gemini. `source_type` ('text'/'audio'), `status` workflow (pending → uploading → analyzing → done/error), `summary jsonb` (titre, tldr, décisions, actions, points clés, questions ouvertes), recherche full-text via colonne générée `search_text` + index GIN tsvector français. Realtime activé pour notifier la UI à la fin du traitement async |

### RLS — modèle mental
- Le **producteur** voit tout, peut tout — **sauf qu'un projet n'est visible que pour les producteurs qui y sont explicitement assignés** (`project_producteurs`). Helper SQL `public.is_producteur()` pour vérifier le rôle, `public.is_project_producteur(p_id)` pour vérifier l'assignation projet.
- Le **prestataire** voit :
  - son propre `profile` + `prestataire_profile`,
  - les `skills` (toute la liste),
  - ses `user_skills`,
  - les missions en `broadcast` qui matchent ses skills (si pas `is_banned()`),
  - les missions qu'il a acceptées,
  - les fichiers qu'il a uploadés ou qui lui sont destinés,
  - ses notifications.
- Le **client** voit :
  - son propre `profile` + son `client_profile`,
  - les projets où il est `client_id`,
  - les épisodes de ses projets,
  - les fichiers de ses projets ou de son hub (`destination_user_id = lui`),
  - les **factures non-draft** de ses projets (RLS de `invoices` + `invoice_lines` filtre `status <> 'draft'`),
  - ses notifications.

### Helpers SQL (cf. `db/schema.sql` + migrations)
- `is_producteur()` → bool
- `current_user_role()` → user_role
- `is_banned()` → bool (utilisé par RLS missions broadcast)
- `is_project_producteur(p_id uuid)` → bool (depuis migration 002)
- `next_invoice_number()` → text — génère `LUM-YYYY-NNN` en scannant le max existant pour l'année en cours (depuis migration 010). Doit être appelé via `admin.rpc("next_invoice_number")` côté server action.
- Trigger `tg_set_updated_at()` attaché à toutes les tables avec `updated_at`.

### Permissions et grants
- "Automatically expose new tables" est **désactivé** dans le projet Supabase → toutes les permissions sont gérées manuellement à la fin de `schema.sql` (et résumées dans `grants.sql`).
- `service_role` : ALL sur public. `authenticated` : SELECT/INSERT/UPDATE/DELETE. `anon` : rien (zéro accès public).
- Si on rajoute une nouvelle table, `ALTER DEFAULT PRIVILEGES` la couvre automatiquement.
- Après toute modif schéma : `notify pgrst, 'reload schema';` pour rafraîchir le cache PostgREST.

### Clients Supabase
- `lib/supabase/client.ts` — `createClient()` → browser, publishable key. À utiliser dans les Client Components.
- `lib/supabase/server.ts` — `createClient()` (async) → Server Components et Server Actions. Gère les cookies.
- `lib/supabase/admin.ts` — `createAdminClient()` → server-only, secret key, **bypass RLS**. À n'utiliser qu'après avoir vérifié que le caller est un producteur.

---

## 5. Logiques métier critiques (à ne JAMAIS oublier)

### 5.1 Hiérarchie de contenu
```
Projet ──┬──> Émission 1 ──┬──> Mission 1 (droniste, 15/07, Sainte-Anne)
         │                 ├──> Mission 2 (cameraman, 16/07)
         │                 ├──> Fichiers
         │                 └──> Documents texte
         ├──> Émission 2 ──> …
         └──> Émission N
```
- Un projet a 2 natures : **"client"** (`client_id` rempli, livrables apparaîtront dans le hub du client) ou **"média/interne"** (`client_id` null, production pour les médias propres du studio). Aucun impact technique en BDD, juste un branchement UI à la création + un badge.
- 1 émission a 2 dates distinctes : **production** (+ heure + durée) + **parution**, un workflow `status` (Idée → En préparation → En tournage → En montage → Livré → Publié), un format (Reportage / Interview / …), un lieu, des intervenants, de l'équipement et des notes.
- 1 mission a 1 compétence requise + lieu + horaire + prix + statut.

### 5.2 Flux Mission "Uber"
1. **Producteur** crée une mission (status = `draft`), choisit la compétence requise.
2. Producteur clique "Envoyer" → status passe à `broadcast`, `broadcast_at = now()`.
3. **Tous les prestataires** non-bannis qui ont la skill requise voient la mission (RLS gère ça automatiquement) → notification.
4. Le **premier** prestataire qui clique "Accepter" : transition atomique vers `accepted` + `accepted_by = lui` + `accepted_at = now()`. Les autres voient désormais "Mission prise" et perdent l'accès (RLS).
5. Le prestataire peut **se désister** plus tard → la mission repasse à `broadcast` ET le prestataire reçoit `banned_until = now() + interval '1 month'`. Pendant cette période, RLS lui cache toutes les nouvelles missions broadcast.

> ⚠️ La transition `broadcast → accepted` doit être **atomique** (au minimum via UPDATE conditionnel `WHERE status = 'broadcast' AND accepted_by IS NULL`). Sans ça, race condition possible entre deux prestataires.

### 5.3 Pénalité de désistement
- Champ `profiles.banned_until` (timestamptz nullable).
- Helper `public.is_banned()` retourne `true` si `banned_until > now()`.
- Visible dans le dashboard prestataire (badge "Pénalité active jusqu'au …").
- Reset manuel possible par un producteur (UPDATE direct, pas d'action UI dédiée pour l'instant).

### 5.4 Création de comptes (P2.1)
- **Pas de self-signup**. Tous les comptes sont créés par les producteurs via le client admin Supabase.
- À la création, le serveur **génère un mot de passe aléatoire** (16 caractères, A-Z a-z 0-9 + symboles sûrs) et l'affiche **une seule fois** dans une modal. Le producteur le transmet manuellement au membre (mail, SMS, etc.).
- La suppression est **physique** (cascade) : `DELETE FROM auth.users` → cascade vers `profiles` → cascade vers `user_skills`, `prestataire_profiles`, etc.

### 5.5 Fichiers
- **Prestataire → Producteur** : upload sur une mission → range automatiquement dans le dossier de la mission (`files.mission_id`).
- **Producteur → Prestataire** : upload ciblé (briefs, docs) → `target = 'hub_prestataire'`, `destination_user_id = id du prestataire`.
- **Producteur → Client** : livraison → `target = 'hub_client'`, `destination_user_id = id du client`.
- Le client ne peut JAMAIS uploader. RLS empêche.

### 5.6 Édition de texte temps réel
- Voulue à terme (Google Docs-like via Tiptap + Yjs).
- **Dépriorisée par Thibault** ("c'est du plus, te prends pas la tête"). MVP : éditeur Tiptap simple, sauvegarde manuelle, pas de Yjs.

### 5.7 Fuseau horaire
- Toutes les dates affichées en `America/Martinique` (UTC-4, pas de DST).
- En BDD on stocke en `timestamptz` (UTC sous le capot). La conversion se fait à l'affichage.

### 5.8 Facturation (P5)
- **1 projet client = N factures**. La facturation n'est dispo que si `projects.client_id IS NOT NULL` (bouton « Facturation » masqué sinon).
- Cycle de vie : `draft` → `sent` (visible client) → `paid` (ou `overdue`) ; chemin alternatif `cancelled`. Un brouillon est éditable, supprimable physiquement ; une facture émise se contente du chemin `cancelled` (on garde l'historique).
- **Numérotation atomique** : `next_invoice_number()` côté Postgres scanne le max existant pour l'année en cours et renvoie `LUM-YYYY-NNN`. Reset implicite à chaque nouvelle année.
- **Snapshots** : à la création, le studio (`STUDIO_INFO`) et le client (`profile` + `client_profile`) sont sérialisés dans `studio_snapshot` / `client_snapshot` (jsonb) sur la ligne `invoices`. Tant que la facture est `draft`, le snapshot client est **rafraîchi à chaque update**. À partir de `sent`, le snapshot est **immuable** — toute modif ultérieure de l'adresse client ne réécrit jamais l'historique.
- **TVA 0 % (art. 293B CGI)** : `STUDIO_INFO.defaultVatRate = 0` + mention obligatoire affichée dans le bloc dédié du PDF.
- **PDF** : généré server-side avec `@react-pdf/renderer` (`src/lib/invoice-pdf.tsx`). Streamé par `GET /api/invoices/[id]/pdf`. RLS-checked : le user-scoped client Supabase tente d'abord un `SELECT id` pour valider l'accès, puis l'admin client fait le full read.
- **Studio info** : hardcodé dans `src/lib/studio-info.ts`. À déplacer dans une table `studio_settings` si on a un jour plusieurs studios sur la même instance LUMEN.

### 5.9 Comptes-rendus de réunion (P6)
- 2 modes d'entrée :
  - **Texte** : on colle des notes/transcription, Gemini résume en sync (server action `createMeetingReportFromText`). Persisté direct en `status='done'`.
  - **Audio** : on uploade un fichier (MP3/M4A/WAV/OGG/FLAC/AAC, jusqu'à 2 GB ≈ 9 h). Pipeline async pour ne pas dépendre du timeout Vercel.
- **Pipeline audio (async)** :
  1. Browser uploade direct vers Storage via signed URL (XHR avec progress bar). Server action `requestMeetingAudioUpload` crée le record en `status='pending'`.
  2. Server action `triggerMeetingAudioProcessing` POST vers l'Edge Function `process-meeting-audio` (fire-and-forget).
  3. Edge Function Deno : download Storage → upload Google Files API (resumable) → wait state ACTIVE → call Gemini 2.5 Flash avec le `file_uri` + JSON schema + `thinking_config.thinking_budget=0` → update record `status='done'` + `summary` jsonb. Cleanup remote file.
  4. UI s'abonne à Supabase Realtime sur `meeting_reports.id=eq.<id>` → notification quand `status='done'` ou `status='error'`.
- **Pourquoi Edge Function et pas server action ?** Vercel Free timeout = 10s. Gemini sur 3h audio = 60-90s. Supabase Edge Functions = 150s timeout en gratuit, largement assez.
- **Realtime** : la table `meeting_reports` doit être dans la publication `supabase_realtime` (cf. migration 014). Pattern identique au moodboard (migration 008).
- **Schema résumé** : `summary jsonb` avec `title`, `tldr`, `decisions[]`, `actions[]` (avec `owner` + `deadline` optionnels), `key_points[]`, `open_questions[]`. Identique entre texte et audio pour qu'un même viewer (`SummaryViewer`) affiche les deux.
- **Recherche full-text** : colonne générée `search_text` (title + summary.title + summary.tldr) + index GIN `to_tsvector('french', search_text)`. Pour l'instant on fait une simple `ILIKE` côté query — facile de basculer vers `websearch_to_tsquery` quand on aura plus de matière.
- **Quotas Gemini** : 10 RPM gratuit sur 2.5-flash. Avec `maxRetries: 0` sur generateObject (texte) et un appel direct côté Edge Function (audio), on consomme 1 unité de quota par CR. Si on dépasse → message d'erreur amélioré avec délai retry exact (`Réessaye dans Xs`).

---

## 6. Sécurité

| Risque | Mitigation |
|--------|-----------|
| RLS oubliée sur une nouvelle table | `enable_automatic_rls` activé dans Supabase + revue manuelle dans `schema.sql` |
| Service role key exposée au client | Variable env `SUPABASE_SECRET_KEY` **sans** préfixe `NEXT_PUBLIC_` → Next.js ne l'inclut jamais dans le bundle client |
| Brute force login | Géré par Supabase Auth (rate limit natif) |
| Token JWT compromis | Rotation possible via Settings → API Keys |
| Race condition acceptation mission | UPDATE conditionnel avec clause `WHERE status = 'broadcast'` (transition atomique) |
| Producteur supprime accidentellement un compte | Modal de confirmation avec saisie du nom complet à reproduire |

---

## 7. Comptes de test (dev uniquement)

Réinitialisables via `npm run seed` (idempotent).

| Rôle | Email | Mot de passe | Notes |
|------|-------|-------------|-------|
| Producteur | `producteur@lumen.studio` | `Lumen2026!` | Thibault LEPINE |
| Producteur | `meghane@lumen.studio` | `Lumen2026!` | Meghane BEUSE |
| Producteur | `anthony@lumen.studio` | `Lumen2026!` | Anthony DOUMITH |
| Prestataire | `prestataire@lumen.studio` | `Lumen2026!` | skills : Cameraman + Droniste |
| Client | `client@lumen.studio` | `Lumen2026!` | — |

---

## 8. État d'avancement

| Phase | Statut | Contenu |
|-------|--------|---------|
| **P0** | ✅ | Bootstrap Next 16, design system OLED+glass, page login visuelle |
| **P1** | ✅ | Auth, schéma BDD complet, proxy de session, 3 dashboards minimaux, seed |
| **P2.1** | ✅ | Gestion équipe + compétences (côté producteur) |
| **P2.2** | ✅ | Projets (client/média) + émissions (réorderable) |
| **P2.3.a** | ✅ | Missions : création/édition/suppression + UI section dans le panel épisode |
| **P2.3.b** | ⏳ | Broadcast Uber (bouton "Envoyer aux prestataires") + désistement+pénalité |
| **P3** | ✅ | Hubs clients (upload/download fichiers) — Supabase Storage |
| **P4** | ⏳ | Calendrier + notifications temps réel (Supabase Realtime) |
| **P5** | ✅ | Facturation : tables `invoices` + `invoice_lines` + `client_profiles`, auto-numérotation, snapshots, PDF stylisé LUMEN (293B), download côté client et producteur |
| **P6** | ✅ | Comptes-rendus de réunion : texte ou audio (jusqu'à 2 GB / 9 h), Edge Function Deno + Gemini File API, async via Realtime, historique recherchable plein-texte, rattachement optionnel à un projet |
| **post-MVP** | ⏳ | PWA, Web Push, WebAuthn, édition texte temps réel (Yjs), workflow devis, génération IA enrichie de projets (avec moodboard/script/shot list) |

---

## 9. Pièges déjà rencontrés (à ne pas répéter)

- ✋ `create-next-app` refuse les dossiers non vides → toujours bouger les fichiers existants avant init.
- ✋ Next 16 a renommé `middleware.ts` → `proxy.ts` et la fonction `middleware()` → `proxy()`.
- ✋ Tailwind v4 n'a plus de `tailwind.config.ts` — toute la config se passe dans `globals.css` via `@theme inline`.
- ✋ Le réglage "Automatically expose new tables = OFF" de Supabase bloque toutes les requêtes REST tant qu'on n'a pas fait les `GRANT` manuels. Voir `db/grants.sql`.
- ✋ Une clé JWT legacy partagée en chat reste indéfiniment dans l'historique → toujours utiliser le nouveau format `sb_secret_*` et faire tourner la clé si exposée.
- ✋ Un Server Component ne peut pas importer `motion/react` directement → extraire en sous-composant client.
- ✋ **shadcn/ui v4+ utilise `@base-ui/react`, pas Radix UI.** Conséquences :
  - **Pas de prop `asChild`** (Radix-only). Base UI utilise `render={<MonComposant />}` à la place.
  - Pattern recommandé pour avoir un Button stylé qui ouvre une Dialog : **ne pas utiliser DialogTrigger** du tout, contrôler `open`/`onOpenChange` manuellement avec un `<Button onClick={() => setOpen(true)}>` à côté.
  - Pour DropdownMenuTrigger : passer `className` directement (le composant rend déjà un `<button>`), **pas de wrapper `<button>` enfant**.
  - **`DropdownMenuItem` utilise `onClick`, PAS `onSelect`** (Radix). `onSelect` est silencieusement ignoré → l'item paraît mort. Pour empêcher la fermeture du menu après le clic (utile quand l'action est inline genre regen mdp), passer `closeOnClick={false}`.
- ✋ **Le proxy ne doit PAS traiter les requêtes non-GET.** Les server actions (POST) et les RSC fetches utilisent un protocole streamé que Next compose lui-même. Si le proxy fait `NextResponse.next({ request })` ou écrit dans la response (typique du pattern Supabase SSR pour rafraîchir les cookies), le stream est corrompu et le client reçoit `An unexpected response was received from the server`. **Solution** : `if (request.method !== "GET") return NextResponse.next();` en début de proxy. La session reste rafraîchie par `createClient()` côté serveur.
- ✋ **Un fichier `"use server"` ne peut exporter QUE des fonctions async.** Exporter une `const` (ex: tableau d'enum) ou un objet fait crasher l'app au render avec `A "use server" file can only export async functions, found object`. Mettre les constantes/types partagés dans un fichier séparé (ex: `episode-types.ts`) que `actions.ts` et la UI importent tous les deux.
- ✋ **`Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })` casse dans `@react-pdf/renderer`.** L'API insère un narrow no-break space (U+202F) entre les milliers et avant le symbole € ; la police par défaut (Helvetica) ne sait pas le rendre et affiche une glyphe absente (typiquement un slash → `1/750 €`). Solution dans le PDF : formater à la main avec des espaces classiques (`replace(/\B(?=(\d{3})+(?!\d))/g, " ")`). Garder `Intl` dans la UI web où le NBSP rend bien et empêche les sauts de ligne au milieu des nombres.
- ✋ **Le particule du nom de famille doit être tapée à part.** Le nom légal officiel de Thibault est « DE LEPINE » (le « de » fait partie du nom de famille, pas une particule de noblesse séparable). Hardcodé dans `src/lib/studio-info.ts` → tout changement du nom légal y est à modifier (et les anciennes factures gardent le `studio_snapshot` figé donc rien à migrer).
- ✋ **Gemini 2.5 Flash a un mode `thinking` activé par défaut** qui consomme jusqu'à 24k tokens INTERNES avant d'émettre la sortie. Avec un schéma riche ça tronque le JSON → "no object generated". Toujours désactiver explicitement avec `providerOptions: { google: { thinkingConfig: { thinkingBudget: 0 } } }` côté AI SDK Vercel, ou `generation_config: { thinking_config: { thinking_budget: 0 } }` côté API REST directe (Edge Function). Côté Edge Function on l'utilise déjà dans `process-meeting-audio`.
- ✋ **`maxRetries` de l'AI SDK Vercel est à 3 par défaut.** Avec le quota gratuit Gemini (10 RPM sur 2.5-flash, 15 RPM sur 2.0-flash), 1 appel = jusqu'à 3 tentatives vers l'API → crame le quota en quelques essais. Toujours mettre `maxRetries: 0` sur `generateObject` / `generateText`. Notre code applique déjà cette règle dans tous les générateurs (`project-generator.ts`, `meeting-summarizer.ts`).
- ✋ **Supabase Realtime ne broadcast pas par défaut.** Pour qu'une table émette des events `INSERT`/`UPDATE`/`DELETE` aux clients abonnés, elle doit être dans la publication `supabase_realtime`. Pattern à mettre dans chaque migration concernée : `alter publication supabase_realtime add table public.<nom>;` (idempotent via `do $$ ... exception when duplicate_object then null; end $$;`). Tables déjà actives : `board_items`, `board_connections` (migration 008), `meeting_reports` (migration 014).
- ✋ **Les Edge Functions Supabase sont en Deno, pas en Node.** Le type-check Next.js ne sait pas parser leurs imports `https://esm.sh/...` ni le global `Deno.*`. Toujours **exclure `supabase/functions` du `tsconfig.json`** (`"exclude": ["node_modules", "supabase/functions"]`). Sinon `npm run build` plante avec `Cannot find name 'Deno'`.
- ✋ **Les Edge Functions Supabase ont `verify_jwt = true` par défaut**, et **les nouvelles clés Supabase au format `sb_secret_*` ne sont PAS des JWT** (c'est un format propriétaire depuis 2025). Conséquence : appeler une Edge Function avec un `Authorization: Bearer sb_secret_xxx` renvoie un `401 UNAUTHORIZED_INVALID_JWT_FORMAT` AVANT même d'entrer dans notre code Deno. Solutions au choix :
  - **Déployer avec `--no-verify-jwt`** : `supabase functions deploy <nom> --no-verify-jwt`. Ne marche que si la fonction vérifie elle-même que les caller sont légitimes (ex: report_id qui doit exister). C'est ce qu'on fait pour `process-meeting-audio`.
  - **Utiliser l'anon key** (toujours un JWT `eyJ...`) au lieu du `sb_secret_*` côté caller. Plus contraignant car l'anon est censée être publique.
  - **Mettre `verify_jwt = false` dans `supabase/config.toml`** sous `[functions.<nom>]` pour rendre la conf persistante au lieu de devoir repasser le flag à chaque deploy.

---

## 10. Commandes utiles

```bash
npm run dev        # Dev server (localhost:3000, Turbopack)
npm run build      # Build prod
npm run start      # Serve build prod
npm run lint       # ESLint
npm run seed       # Re-crée les 3 comptes de test
```

```bash
# Réappliquer le schéma SQL : copier db/schema.sql dans le SQL Editor de Supabase.
# Réappliquer les grants seuls : copier db/grants.sql.
```

```bash
# Re-générer types Supabase (à faire plus tard) :
# npx supabase gen types typescript --project-id fqktidyrxwbdwleijuqk > src/lib/supabase/types.ts
```
