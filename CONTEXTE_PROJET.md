# Contexte projet : App de tontine (Benin, FCFA)

A lire en premier par tout assistant de code (Cursor, Kiro...).

## Organisation
Dossier racine LE_REFUGE_TIC :
- Tontine_App_Backend : NestJS, TypeScript strict, TypeORM 0.3 + PostgreSQL, SnakeNamingStrategy, Joi, class-validator, Swagger /api/docs, prefixe /api/v1.
- tontine_mobile : Expo Router, React Native, React Query. Mode demo (EXPO_PUBLIC_MODE_DEMO=true) ou reel (false). EXPO_PUBLIC_API_URL=http://IP_DU_PC:3000/api/v1. Apres un changement du .env : npx expo start -c.
- Windows, Git en HTTPS. Ne jamais commiter (l'utilisateur le fait lui-meme). Jamais de secret dans Git.

## Conventions backend
Un dossier par table dans src/ (singulier, kebab-case), noms francais, enums dans src/common/enums, synchronize false, migrations obligatoires, onDelete RESTRICT sur l'argent. Montants entiers (FCFA), calcules par le serveur, jamais par le telephone. Fuseau : Africa/Porto-Novo.
Pour tout point non tranche : ne pas inventer, ecrire TODO(decision) (regle metier) ou TODO(verifier) (detail technique), et les lister dans le recap.

## Regles metier (modele v2)
- Mise libre, minimum 200 (parametre en base). Cycle = mois calendaire avec TOUJOURS 31 jours de paiement (une ligne JourCotisation par jour, 28 a 31, somme des coefficients = 31).
- Fonds de caisse = mise du cycle, jamais rendu, va dans CaisseApplication.
- Changement de mise ou regularite : effet au cycle suivant. Jours non payes en fin de cycle : "perdu", rattrapables.
- Retirable = soldeCotisation - fonds de caisse retenus - soldeBloque - retraits en attente.
- Epargne : retrait avant la date = penalite 5 % ; a la date ou apres = 2,75 % (lus dans ParametreSysteme).
- Pret : plafond = retirable x 4 ; 6 mois de regularite ; 3 temoins qui bloquent chacun un quart.
- Grand livre EcritureComptable immuable (triggers PostgreSQL), seule voie : EcritureComptable.enregistrer(). Un depot cree 2 ecritures (cotisation + fonds de caisse). Frais FedaPay hors grand livre (Transaction.fraisFedapay).
- Retrait total : solde a 0, souscription cloturee, ecriture liberation_fonds.

## FedaPay
Sandbox direct (compte personnel du developpeur), FEDAPAY_ENV=sandbox. Variables : FEDAPAY_SECRET_KEY, FEDAPAY_WEBHOOK_SECRET, APP_PUBLIC_URL. Tunnel cloudflared pour le webhook (l'adresse change a chaque relance). Sans tunnel : POST /dev/simuler-webhook { transactionId, resultat: "approuve"|"refuse" }. Ne jamais mettre de cle dans Git ni dans une capture.

## Etat d'avancement
FAIT : prompts 1 (16 tables), 2 (auth, jetonRetrait a usage unique), 3 (cycles et cotisation), 4 (depots + FedaPay + webhook + grand livre), 5/5b/5c (retraits, rapport, fuseau), 6 (epargne, depots et retraits d'epargne), M1 (mobile branche sur le vrai backend). 158 tests automatiques OK.
A TESTER A LA MAIN : voir TESTS_MANUELS_EPARGNE.txt.
SUIVANT : M2 (ecrans mobile epargne + rattrapage des jours dans Cotiser), puis prompt 7 Prets, 8 Admin et notifications, tests des calculs d'argent, hebergement HTTPS, FedaPay live, verification UEMOA/BCEAO, Play Store.

## Points a trancher (TODO(decision)) : l'utilisateur fait des entretiens
Jours doubles/triples ; hebdomadaire (3 jours en plus) ; inscription en milieu de mois ; fonds de caisse d'un nouveau cycle ; mise (entier >= 200 ou multiples de 500) ; paiement partiel d'un jour ; interets du pret ; gages en cas d'impayes ; versement du pret ; frais FedaPay (ajoutes ou deduits) ; arrondi de la retenue d'epargne (provisoire : arrondi superieur) ; retrait partiel d'epargne apres l'echeance ; format du numero beninois ; reglementation UEMOA/BCEAO.

## Facon de travailler avec l'utilisateur
Developpeur junior, francais, etapes tres detaillees (ou cliquer, quoi taper). Il se perd si le plan change : si tu changes d'avis, le dire clairement. Lui donner un recap a la fin de chaque tache (fichiers, routes, migrations, TODO, ce qu'il doit tester a la main).
