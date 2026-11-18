# Application mobile de tontine

Application Expo/React Native (SDK 58) pour gérer une tontine : cotisation quotidienne,
hebdomadaire ou mensuelle, paiements Mobile Money via FedaPay. Pays : Bénin. Monnaie : FCFA.

---

## Prérequis

- Node 20+
- Expo Go installé sur le téléphone Android
- Backend NestJS (`Tontine_App_Backend`) démarré sur le même réseau Wi-Fi

---

## Démarrage rapide

```bash
# 1. Installer les dépendances
npm install

# 2. Copier et éditer les variables d'environnement
cp .env.example .env
#   → Éditez EXPO_PUBLIC_API_URL selon votre réseau (voir ci-dessous)

# 3. Démarrer le serveur de développement
npx expo start

# 4. Scanner le QR code depuis Expo Go sur Android
```

---

## Configuration réseau

L'app mobile doit joindre le backend NestJS via HTTP.

| Situation | Valeur de `EXPO_PUBLIC_API_URL` |
|-----------|--------------------------------|
| Téléphone réel sur le même Wi-Fi que le PC | `http://192.168.1.20:3000/api/v1` (remplacez par l'IP locale de votre PC) |
| Émulateur Android (Android Studio) | `http://10.0.2.2:3000/api/v1` |

Trouvez l'IP locale de votre PC :
- Windows : `ipconfig` → "Adresse IPv4"
- macOS/Linux : `ifconfig` ou `ip a`

---

## Mode démo

Sans backend, vous pouvez tester le design avec des données fictives (cas de Koffi : mise 500 F/jour,
cycle de novembre, 2 jours payés, jours perdus, un jour ×2) :

```bash
EXPO_PUBLIC_MODE_DEMO=true npx expo start
```

---

## Stack

| Couche | Technologie |
|--------|------------|
| Navigation | Expo Router (fichiers dans `src/app/`) |
| Données serveur | @tanstack/react-query |
| Authentification | expo-secure-store (accessToken + refreshToken) |
| Polices | @expo-google-fonts/plus-jakarta-sans |
| Icônes | @expo/vector-icons — Ionicons |
| Dégradés | expo-linear-gradient |
| Animations | react-native-reanimated v4 |
| Retour haptique | expo-haptics |

---

## Routes backend disponibles (testées en mode réel)

| Méthode | Route | Écran |
|---------|-------|-------|
| POST | /auth/inscription | Inscription |
| POST | /auth/connexion | Connexion |
| POST | /auth/rafraichir | Automatique (intercepteur) |
| POST | /auth/deconnexion | Profil |
| GET | /auth/moi | Restauration session |
| POST | /auth/changer-password | Profil |
| POST | /auth/code-retrait | Profil |
| POST | /auth/code-retrait/verifier | Retrait |
| GET | /souscriptions | Accueil, choisir-mise |
| POST | /souscriptions | Choisir-mise |
| GET | /cycles | Accueil, cotiser |
| GET | /jours-cotisation | Accueil, cotiser |
| GET | /portefeuilles | Accueil, retirer |
| GET | /ecritures-comptables | Accueil, rapport |
| GET | /notifications | Notifications |
| PATCH | /notifications/:id/lue | Notifications |

## Routes manquantes (marquées TODO(backend))

Ces routes ne sont **pas encore implémentées** côté serveur. Jusqu'à leur ajout, l'app
renvoie "Fonctionnalité pas encore disponible" en mode réel (et utilise les fixtures en mode démo).

| Route attendue | Écran concerné | Comportement actuel |
|----------------|---------------|---------------------|
| POST `/depots` | Cotiser → paiement FedaPay | Toujours erreur en mode réel |
| POST `/retraits` | Retirer → retrait Mobile Money | Toujours erreur en mode réel |
| GET `/portefeuilles/moi` ou calcul `retirable` | Accueil, retirer | `retirable = null` (affiche `soldeCotisation` en fallback) |
| GET `/cycles/:id/jours` ou enrichissement des cycles | Accueil, cotiser | Jours dissociés du cycle si > 1 souscription |

---

## Structure du projet

```
tontine_mobile/
├── src/
│   ├── app/            Écrans (Expo Router)
│   │   ├── (auth)/     bienvenue, connexion, inscription
│   │   ├── (onboarding)/ choisir-mise
│   │   ├── (tabs)/     index (Accueil), cotiser, retirer, rapport
│   │   ├── profil.tsx
│   │   └── notifications.tsx
│   ├── api/            Client HTTP + domaines + fixtures démo
│   ├── components/     Composants réutilisables
│   ├── constants/      NOM_APP, MISE_MINIMALE, env…
│   ├── hooks/          useAuth, useRequetes
│   ├── theme/          couleurs, typographie, espacements, rayons, ombres
│   ├── types/          Déclarations TypeScript globales
│   └── utils/          formaterFCFA, dates, telephone, haptics
├── babel.config.js     Plugin Reanimated
├── app.json
└── .env.example
```

---

## Commandes utiles

```bash
npx expo start          # démarrer le serveur dev
npx tsc --noEmit        # vérifier les types
npx expo lint           # linter ESLint
npx expo install --fix  # corriger les versions incompatibles
```
