# Contexte du projet — Le Refuge (Tontine)

Ce fichier résume l'état du projet, les décisions prises, la logique métier et
ce qui reste à faire. À lire en début de session avant de travailler sur le code.

---

## 1. Vue d'ensemble

Application mobile de **tontine** pour le Bénin.

- **Monnaie** : FCFA, entiers uniquement, jamais de float.
- **Pays** : Bénin — préfixe téléphonique `+229`, numéros à 10 chiffres locaux
  (tous commencent par `01`), format complet stocké en base : `229` + 10 chiffres
  = 13 chiffres (ex. `2290197000000`).
- **Paiements** : MTN Mobile Money via FedaPay.
- **Heure** : UTC+1, sans heure d'été (Bénin). Toutes les dates ISO reçues de
  l'API sont en UTC, affichées à l'heure du Bénin.

### Principe de la tontine

Un membre souscrit avec une **mise de base** (minimum 200 F) et une **régularité**
(jour / semaine / mois). Chaque cycle dure **31 jours de paiement** (les mois
courts ont des jours à coefficient ×2 pour compenser). À la fin du cycle, le
membre récupère son solde cotisé moins le fonds de caisse retenu.

---

## 2. Logique métier clé (décisions confirmées)

### Fonds de caisse
- Retenu **une seule fois**, au **premier dépôt** du cycle.
- Montant = **1 × mise de base** du cycle.
- Exemple : mise 500 F, cycle novembre →
  - 1er dépôt : écriture cotisation +500 F, écriture fonds_caisse −500 F
  - 2e au 31e dépôt : écriture cotisation uniquement (+montantDu)
  - Fin de cycle : soldeCotisation = 15 500 F, fondsCaisseRetenu = 500 F,
    **retirable = 15 000 F**
- `retirable = soldeCotisation − fondsCaisseRetenu − soldeBloque` (calculé à la
  demande, non stocké, jamais négatif)
- Si le membre retire tout : son compteur repart à 0, le fonds de caisse reste
  définitivement acquis à l'application.

### Cycle et jours
- Chaque cycle = un mois calendaire complet (1er au dernier jour du mois),
  fuseau Africa/Porto-Novo.
- Toujours **31 jours de paiement** : les mois < 31 jours ont des jours à
  `coefficient` 2 (voire 3) concentrés sur les **derniers jours du mois**
  (TODO(decision) : choix des jours doublés).
- `montantDu` d'un jour = `miseBase × coefficient`.
- La somme des coefficients d'un cycle vaut **toujours 31**.
- Statuts d'un `JourCotisation` : `a_payer` → `paye`, `perdu`, `rattrape`.
- Inscription en milieu de mois : cycle 1 va du jour de démarrage au dernier
  jour du mois (TODO(decision) : comportement provisoire).

### Téléphone
- Saisie sur le mobile : 10 chiffres locaux (ex. `0197000000`) **ou** 13 avec
  préfixe (ex. `2290197000000`).
- Stocké en base : `229` + 10 chiffres = `2290197000000`.
- Le mobile normalise vers `229` + 10 chiffres avant d'envoyer à l'API.
- Le backend (`normaliserPhone`) convertit aussi : 10 chiffres locaux → ajoute
  `229`; 13 chiffres avec préfixe → gardé tel quel; toute autre longueur →
  chiffres bruts (rétro-compatibilité).
- `ADMIN_PHONE` dans le `.env` backend doit être au format complet :
  `2290191652563` (et non `0191652563`).

### Mise minimale
- 200 F (constante `MISE_MINIMALE` côté mobile, paramètre `mise_minimale` en base).
- TODO(decision) : multiples de 500 uniquement, ou tout entier >= 200 ?

---

## 3. Structure du projet

```
Le_refuge_tic/
├── .gitattributes           Normalisation fins de ligne (text=auto)
├── Tontine_App_Backend/     Backend NestJS
├── tontine_mobile/          App Expo/React Native
├── CONTEXTE_PROJET.md       ← ce fichier
└── Diagramme/               Diagrammes de classes
```

---

## 4. Backend — Tontine_App_Backend

### Stack
- NestJS 11, TypeScript strict
- TypeORM 1.x, PostgreSQL (`pg` 8), snake_case naming strategy
- JWT (access 15 min + refresh 30 j avec rotation, jeton retrait 5 min)
- bcrypt (12 rounds), Joi (validation env), Throttler, `@nestjs/schedule`
- Préfixe global : `/api/v1`
- Swagger : `/api/docs`

### Commandes utiles
```bash
npm run start:dev          # démarrer en dev (watch)
npm run build              # compiler
npm run migration:run      # appliquer les migrations
npm run seed               # insérer paramètres système + admin
npm run seed:demo          # créer un membre de démo avec souscription (dev seulement)
npm run db:reset -- --yes  # RESET COMPLET (dev uniquement)
npm run lint               # ESLint lecture seule (sans --fix)
npm run lint:fix           # ESLint avec correction automatique (usage volontaire)
```

### Entités (17 au total)
`Membre`, `Souscription`, `Cycle`, `JourCotisation`, `Portefeuille`,
`Transaction`, `EcritureComptable`, `CaisseApplication`, `Epargne`,
`RetraitEpargne`, `Pret`, `Garantie`, `Remboursement`, `ParametreSysteme`,
`Notification`, `WebhookFedapay`, `JetonRafraichissement`

### Enums importants (valeurs exactes en base)
| Enum | Valeurs |
|---|---|
| `Regularite` | `jour`, `semaine`, `mois` |
| `StatutSouscription` | `active`, `cloturee` |
| `StatutCycle` | `en_cours`, `termine` |
| `StatutJourCotisation` | `a_payer`, `paye`, `perdu`, `rattrape` |
| `TypeTransaction` | `depot`, `retrait` |
| `StatutTransaction` | `en_attente`, `reussi`, `echoue` |
| `TypeEcriture` | `cotisation`, `fonds_caisse`, `retrait`, `epargne`, `retrait_epargne`, `penalite`, `retenue_epargne`, `interet`, `gage_bloque`, `gage_libere`, `gage_preleve`, `pret_octroye`, `remboursement` |
| `SensEcriture` | `credit`, `debit` |
| `Role` | `membre`, `admin` |
| `StatutMembre` | `actif`, `suspendu`, `cloture` |

### Routes disponibles (implémentées et testées)
| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/auth/inscription` | Public | Crée un compte, renvoie `{membre, accessToken, refreshToken}` |
| POST | `/auth/connexion` | Public | Connexion, renvoie `{membre, accessToken, refreshToken}` |
| POST | `/auth/rafraichir` | Public | Rotation du refreshToken |
| POST | `/auth/deconnexion` | JWT | Révoque le refreshToken |
| GET | `/auth/moi` | JWT | Membre connecté |
| POST | `/auth/changer-password` | JWT | Change le mot de passe, révoque tous les refresh |
| POST | `/auth/code-retrait` | JWT | Définit/change le code de retrait (4-6 chiffres) |
| POST | `/auth/code-retrait/verifier` | JWT | Vérifie le code, renvoie un jeton retrait (texte brut) |
| GET | `/souscriptions` | JWT | Souscriptions du membre |
| POST | `/souscriptions` | JWT | Crée une souscription `{miseBase, regularite}`, génère le cycle 1 |
| GET | `/souscriptions/active` | JWT | Souscription active du membre (404 si aucune) |
| POST | `/souscriptions/changement` | JWT | Demande changement mise/régularité (effet cycle suivant) |
| GET | `/cycles` | JWT | Cycles du membre |
| GET | `/cycles/en-cours` | JWT | Cycle actif + jours + prochaine échéance (404 sinon) |
| GET | `/cycles/jours-rattrapables` | JWT | Jours « perdu » du membre tous cycles confondus |
| POST | `/admin/cycles/cloturer-echus` | Admin | Déclenche la clôture manuelle des cycles échus |
| GET | `/jours-cotisation` | JWT | Jours de cotisation du membre |
| GET | `/portefeuilles` | JWT | Portefeuille du membre |
| GET | `/portefeuilles/moi` | JWT | Soldes + `fondsCaisseRetenu` + `retirable` |
| GET | `/ecritures-comptables` | JWT | Grand livre du membre |
| GET | `/notifications` | JWT | Notifications du membre |
| PATCH | `/notifications/:id/lue` | JWT | Marque une notification comme lue |

### Routes implémentées lors de la session dépôts (prompt 4)
| Méthode | Route | Accès | Description |
|---|---|---|---|
| POST | `/depots` | JWT membre | Initier un dépôt Mobile Money via FedaPay |
| GET | `/transactions` | JWT | Liste paginée des transactions du membre (`?page=1&limite=20`) |
| GET | `/transactions/:id` | JWT | Détail d'une transaction (polling statut) |
| POST | `/webhooks/fedapay` | Public | Webhook FedaPay (signature vérifiée, idempotent) |
| GET | `/webhooks` | Admin | Liste des webhooks reçus |
| GET | `/webhooks/:id` | Admin | Détail d'un webhook |
| GET | `/rapport` | JWT membre | Écritures groupées par mois de cycle (`?mois=AAAA-MM&type=tout\|cotisations\|retraits`) |
| POST | `/dev/simuler-webhook` | Public | Simuler un webhook sans signature (dev uniquement, `NODE_ENV=development`) |

### Routes NON encore implémentées
| Route attendue | Usage |
|---|---|
| `POST /retraits` | Retrait vers Mobile Money |

### Nouveaux modules (prompt 4 — dépôts FedaPay)
- **`src/fedapay/`** : `IFedapayClient` (interface), `FedapayClientImpl` (SDK fedapay v1.2.5), `FedapayClientFaux` (tests). `generateToken()` est une méthode d'**instance** (`Transaction.retrieve(id).then(t => t.generateToken())`), pas statique.
- **`src/depot/`** : `POST /depots`, logique anti double-clic (10 min, mêmes `jourIds`), calcul frais via `ParametreSystemeService`, référence unique `TX-<membreId>-<AAAAMMJJ>-<uuid8>`.
- **`src/rapport/`** : `GET /rapport` groupé par mois de cycle.
- **`src/dev/`** : `POST /dev/simuler-webhook` (dev seulement).

### Logique dépôts (implémentée)
- `Transaction.joursCibles` (jsonb nullable) : ids des jours visés par la transaction.
- **`TransactionService.confirmer(txId, manager)`** : dans une seule transaction DB avec verrou pessimiste — marque les jours payés (statut `rattrape` si le jour était `perdu`), crée les écritures comptables par cycle, retient le fonds de caisse au premier dépôt du cycle (`doitRetenirFondsCaisse`), recalcule le portefeuille depuis le grand livre.
- **Grand livre immuable** : triggers PostgreSQL `BEFORE UPDATE/DELETE` sur `ecritures_comptables` et `caisse_application` (migration `1795100000000-DepotsFedapay`).
- **Webhook idempotent** : signature `X-FEDAPAY-SIGNATURE` vérifiée sur le corps brut (`rawBody: true` dans `main.ts`), enregistrement systématique dans `WebhookFedapay` avec `idFedapayRef` + index unique partiel pour éviter le double traitement.
- **`doitRetenirFondsCaisse(cycleId, manager)`** : vérifie l'absence d'écriture `fonds_caisse` existante pour ce cycle. TODO(decision) : comportement pour les cycles suivants (provisoire : même règle).

### Variables d'environnement ajoutées (prompt 4)
| Variable | Valeur exemple | Description |
|---|---|---|
| `FEDAPAY_WEBHOOK_SECRET` | `wh_sandbox_xxx` | Secret de signature webhook FedaPay |
| `APP_PUBLIC_URL` | `https://xxxx.trycloudflare.com` | URL publique accessible par FedaPay pour le callback |
| `APP_ENV` | `development` | Environnement app (interdit `FEDAPAY_ENV=live` si pas `production`) |

### Paramètre système ajouté
| Clé | Valeur | Description |
|---|---|---|
| `pourcentage_frais_fedapay` | 0 | % frais FedaPay ajoutés au montant du dépôt (provisoire : 0) |

### Note technique : chargement du .env
`main.ts` importe `dotenv/config` en tout premier pour que `process.env.NODE_ENV` soit disponible lors de l'évaluation statique de `app.module.ts` (nécessaire pour le chargement conditionnel de `DevModule`).
- **`SouscriptionService.genererCycle()`** : crée un `Cycle` avec ses
  `JourCotisation` (coefficients, montants). Premier cycle : du jour de
  démarrage au dernier jour du mois. Cycles suivants : mois calendaires complets.
- **Clôture automatique** : tâche cron à 00:05 Africa/Porto-Novo. Passe les
  jours `a_payer` à `perdu`, génère le cycle suivant. Idempotente (verrou
  advisory PostgreSQL + contrainte unique). Rattrapage de retard en boucle.
- **`JourCotisationService.marquerPaye(id, montant)`** : incrémente `montantPaye`,
  passe à `paye` quand `montantPaye >= montantDu`. Refuse un jour déjà payé.
- **`CycleService.rattraperJours(jourIds, membreId)`** : vérifie appartenance et
  éligibilité (perdu ou a_payer échu), calcule le total. Pas de paiement ici.
- **`PortefeuilleService.retirableDuMois()`** : `max(0, soldeCotisation −
  fondsCaisseRetenu − soldeBloque)` où `fondsCaisseRetenu` = somme réelle des
  écritures `fonds_caisse` du membre (0 tant qu'aucun dépôt).

### TODO(decision) backend
| Emplacement | Sujet |
|---|---|
| `souscription.service.ts` | Mise : tout entier >= 200, ou multiples de 500 ? |
| `cycle.util.ts` `repartirCoefficients` | Choix des jours doublés (derniers / choisis par le membre / fixés par le système) |
| `souscription.service.ts` `genererCycle` | Inscription en milieu de mois (comportement provisoire : cycle 1 = jour démarrage → fin du mois) |
| `cycle.util.ts` + `souscription.service.ts` | Fonds de caisse du nouveau cycle : retenu à l'ouverture ou au premier dépôt ? (provisoire : premier dépôt) |
| `jour-cotisation.service.ts` | Paiement partiel d'un jour : autoriser ou exiger le règlement intégral en une fois ? |
| `src/depot/depot.service.ts` | Frais FedaPay : ajoutés au montant à payer (provisoire) ou déduits du solde ? |
| `src/depot/depot.service.ts` | Tarif réel FedaPay en sandbox (provisoire : 0 %) |
| `src/transaction/transaction.service.ts` `doitRetenirFondsCaisse` | Fonds de caisse cycles suivants : même règle que premier cycle (provisoire) |

### TODO(verifier) backend
| Emplacement | Sujet |
|---|---|
| `src/fedapay/fedapay-client.impl.ts` | FedaPay attend-il les 10 chiffres locaux (`0197000000`) ou le format international (`22997000000`) dans `phone_number.number` ? |
| `src/webhook-fedapay/webhook-fedapay.service.ts` | Structure exacte du payload webhook FedaPay : `payload.id` ou `payload.transaction.id` ? À confirmer en sandbox. |

### Paramètres système (table `parametres_systeme`)
| Clé | Valeur | Description |
|---|---|---|
| `mise_minimale` | 200 | Mise minimale (FCFA) |
| `jours_par_mois` | 31 | Jours de paiement par cycle |
| `penalite_epargne_anticipee` | 5 | % pénalité retrait épargne avant échéance |
| `retenue_epargne_echeance` | 2.75 | % retenue retrait épargne à échéance |
| `mois_regularite_pret` | 6 | Mois de régularité pour un prêt |
| `multiplicateur_pret` | 4 | Plafond prêt = retirable × multiplicateur |
| `max_tentatives_connexion` | 5 | Anti-bruteforce connexion |
| `duree_blocage_connexion_minutes` | 15 | Durée blocage connexion |
| `max_tentatives_code_retrait` | 3 | Anti-bruteforce code retrait |
| `duree_blocage_code_retrait_minutes` | 30 | Durée blocage code retrait |

### Script db:reset
```bash
npm run db:reset           # avec confirmation interactive (taper "oui")
npm run db:reset -- --yes  # sans confirmation (scripts CI)
npm run db:reset -- --force  # autoriser un hôte non-local
```
Garde-fous : refuse si `NODE_ENV=production`, refuse si `DB_HOST` n'est pas
`localhost` ou `127.0.0.1` sans `--force`.

---

## 5. Mobile — tontine_mobile

### Stack
- Expo SDK 58, React Native 0.88, TypeScript strict (zéro `any`)
- Expo Router (fichiers dans `src/app/`)
- @tanstack/react-query (données serveur), fetch natif (pas d'axios)
- expo-secure-store (jetons), expo-linear-gradient, expo-haptics
- @expo-google-fonts/plus-jakarta-sans (5 graisses), @expo/vector-icons Ionicons
- react-native-reanimated 4

### Commandes
```bash
npx expo start      # démarrer (Expo Go sur Android)
npx expo start -c   # avec cache vidé (obligatoire après modif app.json)
npx tsc --noEmit    # vérifier les types
```

### Variables d'environnement (.env)
```
EXPO_PUBLIC_API_URL=http://192.168.1.XX:3000/api/v1  # IP locale du PC sur Wi-Fi
EXPO_PUBLIC_MODE_DEMO=false  # true = données fictives (cas Koffi), pas de backend
```
- Émulateur Android : `http://10.0.2.2:3000/api/v1`
- Téléphone réel : IP locale du PC (`ipconfig` sur Windows)

### Structure src/
```
src/
├── app/               Écrans (Expo Router)
│   ├── _layout.tsx    Providers, polices, GateNavigation, overlay splash
│   ├── (auth)/        bienvenue, connexion, inscription
│   ├── (onboarding)/  choisir-mise
│   ├── (tabs)/        index (Accueil), cotiser, retirer, rapport
│   ├── profil.tsx
│   └── notifications.tsx
├── api/               Client HTTP + domaines + fixtures démo
│   ├── client.ts      fetch, single-flight refresh, timeout 15s
│   ├── jetons.ts      expo-secure-store (async API)
│   ├── fixtures.ts    Données démo (cas Koffi)
│   ├── auth.ts / souscriptions.ts / cycles.ts / ...
│   └── types.ts       Types exacts des entités backend
├── components/        Composants réutilisables
├── constants/         app.ts (constantes), env.ts (vars d'env)
├── hooks/             useAuth.tsx, useRequetes.ts
├── theme/             couleurs, typographie, espacements, rayons, ombres
├── types/             env.d.ts
└── utils/             formaterFCFA, dates, telephone, haptics
```

### Navigation (GateNavigation dans _layout.tsx)
| État session | Rôle | État souscription | Segment courant | Action |
|---|---|---|---|---|
| `deconnecte` | — | — | pas `(auth)` | → `/bienvenue` |
| `connecte` | `admin` | — | `(auth)` ou `(onboarding)` | → `/` |
| `connecte` | `admin` | — | autre | rien |
| `connecte` | `membre` | `non` | pas `(onboarding)` | → `/choisir-mise` |
| `connecte` | `membre` | `oui` | `(auth)` ou `(onboarding)` | → `/` |
| `connecte` | `membre` | `oui` | `(tabs)`, `profil`, `notifications` | rien |
| `chargement` ou `inconnu` | — | — | — | attendre |

Le Stack ne se démonte jamais. L'attente splash est gérée par un overlay opaque
positionné en absolu par-dessus le Stack (évite le flash au démarrage).
L'admin ne passe jamais par `choisir-mise` (pas de souscription).

### Gestion des jetons
- `accessToken` + `refreshToken` dans expo-secure-store (async).
- Rafraîchissement à **vol unique** : un seul appel `/auth/rafraichir` en
  parallèle, les autres requêtes attendent.
- Rotation stricte : un refreshToken ne sert qu'une fois. Réutiliser un ancien
  révoque toute la session.
- Au démarrage : si un refreshToken existe → `etatSession = "connecte"`
  immédiatement (pas de flash), validation réseau en arrière-plan.
- Pas de réseau au démarrage : on garde `etatSession = "connecte"`, les écrans
  affichent leurs squelettes. On ne déconnecte PAS sur une erreur réseau seule.

### Thème (src/theme/)
| Token | Valeur |
|---|---|
| `fond` | `#FAF8F3` |
| `surface` | `#FFFFFF` |
| `primaire` (émeraude) | `#0E7C5A` |
| `primaireFonce` | `#083D2E` |
| `primaireTresClair` | `#E6F4EE` |
| `or` (fonds de caisse) | `#E9A93A` |
| `orClair` | `#FBF1DA` |
| `danger` | `#D64545` |
| `succes` | `#1F9D6B` |
| `texteSecondaire` | `#66726B` |
| Carte `borderRadius` | 24 |
| Bouton `borderRadius` | 16 |

Police : Plus Jakarta Sans (400/500/600/700/800). Montants en 800 (ExtraBold).

### Conventions importantes
- **Aucun calcul métier côté mobile** (cycles, retirable, fonds de caisse) :
  le téléphone affiche ce que le serveur renvoie. Seule exception : aperçu
  indicatif de la mise sur l'écran choisir-mise (marqué "indicatif").
- **Montants** : entiers FCFA, format `formaterFCFA()` → "6 000 F" (espace
  insécable fine). Jamais `Intl`.
- **Style** : zéro style codé en dur dans les écrans, tout passe par `src/theme`.
- **`style` prop** du composant `Bouton` atterrit sur le `Pressable` (pas sur
  `Animated.View`) — nécessaire pour que `flex: 1` fonctionne correctement sur Android.
- **`POST /souscriptions`** n'attend que `{ miseBase, regularite }` — le membre
  est déduit du jeton JWT côté serveur. Ne pas envoyer `membreId` ni `dateDemarrage`.

### Mode démo (EXPO_PUBLIC_MODE_DEMO=true)
Cas de **Koffi Adjovi**, mise 500 F/jour, cycle novembre 2026 :
- Jours 1 et 2 payés (jour 2 = coefficient ×2 = 1 000 F)
- Jours 3 à 11 : perdus
- Jour 12 : aujourd'hui (à payer)
- soldeCotisation = 1 000 F, fondsCaisseRetenu = 500 F, retirable = 1 000 F
- Écritures : cotisation +500 F le 1er nov (+ fonds_caisse −500 F, **1 seule fois**),
  cotisation +1 000 F le 2 nov (aucune retenue)

---

## 6. Points non tranchés (TODO decision)

| # | Sujet |
|---|---|
| 1 | Mise : multiples de 500 uniquement, ou tout entier >= 200 ? |
| 2 | Format numéro béninois : validation supplémentaire côté backend (ex. 01XXXXXXXX seulement) ? |
| 3 | FedaPay : page hébergée ou push MTN direct ? |
| 4 | Frais FedaPay : ajoutés au montant (provisoire) ou déduits du solde ? |
| 5 | Nom définitif de l'application (actuellement "Le Refuge", TODO logo) |
| 6 | Jours doublés d'un cycle : derniers jours du mois (provisoire) / choisis par le membre / fixés par le système ? |
| 7 | Inscription en milieu de mois : cycle 1 partiel (provisoire) ou autre règle ? |
| 8 | Fonds de caisse du nouveau cycle : retenu au premier dépôt (provisoire) — même règle pour les cycles suivants ? |
| 9 | Paiement partiel d'un jour de cotisation : autorisé ou règlement intégral obligatoire ? |
| 10 | Tarif réel FedaPay en sandbox / live (provisoire : 0 %) |

---

## 7. Ce qui reste à implémenter (prochaines sessions)

### Backend (priorité haute)
1. **Retrait** : `POST /retraits`
   - Vérifie le jeton de retrait (audience `tontine-retrait`)
   - Calcule `retirable` via `retirableDuMois()`
   - Crée une `Transaction` FedaPay de type `retrait`
   - Si retrait total : remet `soldeCotisation` à 0 (le `fondsCaisseRetenu` reste acquis à l'application)

### Mobile (priorité haute)
- Brancher l'écran **Cotiser** sur `POST /depots` + polling `GET /transactions/:id` + affichage `urlPaiement` dans WebView
- Brancher l'écran **Retirer** sur `POST /retraits` dès que la route existe
- Remplacer `TODO(logo)` par un vrai logo

---

## 8. Bugs corrigés (historique session)

| Bug | Cause | Correction |
|---|---|---|
| Champ mise affiche "2002" en tapant "2" | `TextInput` contrôlé avec transformation pendant la frappe | Séparation état texte brut / valeur validée dans `SelecteurMise` |
| Boucle choisir-mise après création souscription | `GateNavigation` voyait `etatSouscription="non"` pendant le refetch | `useEtatSouscription` retourne `"inconnu"` aussi pendant `isFetching` |
| Rien ne se passe au 1er clic sur "Commencer" | `GateNavigation` n'avait pas de branche pour `(onboarding)` avec souscription active | Ajout : `if (dansAuth \|\| segment0 === "(onboarding)") router.replace("/")` |
| Profil inaccessible (retour sur Accueil) | `GateNavigation` redirigeait vers `/` depuis tout segment non-tabs | Restriction aux seuls segments `(auth)` et `(onboarding)` |
| Flash écran connexion au démarrage | Stack démonté/remonté quand `pret` repassait à `false` | Stack toujours monté, overlay opaque en absolu pendant l'attente |
| Flash inscription → connexion → accueil | Démontage du Stack lors du refetch post-création souscription | Même correction overlay, `hideCalledRef` pour n'appeler `hideAsync` qu'une fois |
| Bouton "Tout retirer" déborde | `style` (flex:1) appliqué sur `Animated.View` au lieu du `Pressable` | `style` prop du `Bouton` atterrit sur `Pressable`, `alignSelf:"stretch"` sur `Animated.View` |
| Admin ne peut pas se connecter | `ADMIN_PHONE=0191652563` (sans préfixe 229) stocké tel quel, mobile envoie `2290191652563` | `.env` : `ADMIN_PHONE=2290191652563` |
| Fonds de caisse retenu à chaque dépôt dans les fixtures | Fixtures mal modélisées | Fonds de caisse retenu uniquement au 1er dépôt dans `fixtures.ts` |
| Animation onglets rapport trop saccadée | `withSpring` avec rebond dans `ControleSegmente` | Remplacé par `withTiming` 220 ms `Easing.out(cubic)` |
| Point dans la cellule du jour courant dans le carnet | `avecPoint` rendu dans `CarnetDuMois` | Supprimé — le contour vert suffit à identifier le jour courant |
| `FedaPay.Transaction.generateToken is not a function` | `generateToken` est une méthode d'instance, pas statique | `genererLienPaiement` appelle désormais `Transaction.retrieve(id)` puis `instance.generateToken()` |
| Carnet du mois : erreur "impossible de générer" au premier chargement | `obtenirCycleEnCours` faisait deux requêtes séquentielles (`/cycles` puis `/jours-cotisation`), la seconde pouvait recevoir un 401 pendant que les jetons s'écrivaient | Remplacement par un appel unique à `GET /cycles/en-cours` qui renvoie cycle + jours |
| Flash écran connexion au démarrage (token existant) | Splash natif se cachait avant que la requête souscription réponde, `GateNavigation` voyait `etatSouscription="inconnu"` et restait sur auth | Splash reste visible jusqu'à `etatSouscription !== "inconnu"` ; timeout 6 s de secours déclenché uniquement si `etatSession === "connecte"` |
| `/dev/simuler-webhook` absent de Swagger | `process.env.NODE_ENV` lu avant que `ConfigModule` charge le `.env`, `DevModule` non inclus | `main.ts` importe `dotenv/config` en premier, avant tout import NestJS |
| Colonne `jours_cibles` inexistante en base | Migration non appliquée après ajout de la colonne à l'entité | `npm run migration:run` applique `1795100000000-DepotsFedapay` |
| Connexion mobile bloquée : "numéro invalide" | `normaliserPhone` backend ne normalisait pas vers `229`+10 → formats incohérents entre Swagger et mobile | `normaliserPhone` convertit maintenant 10 chiffres locaux → `229`+10 |
| Admin redirigé vers choisir-mise | `GateNavigation` ne vérifiait pas le rôle | `GateNavigation` exclut l'admin de la redirection vers `choisir-mise` |
| Création souscription refusée (400) | Mobile envoyait `membreId` et `dateDemarrage` inconnus du nouveau `CreerSouscriptionDto` | Corps réduit à `{ miseBase, regularite }` dans `souscriptions.ts` |
