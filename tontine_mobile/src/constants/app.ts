// Constantes globales de l'application.

/** Nom de l'application. TODO(logo) : remplacer le texte par un vrai logo. */
export const NOM_APP = "Le Refuge";

/** Version affichée dans le profil. */
export const VERSION_APP = "1.0.0";

/**
 * Mise minimale de cotisation (FCFA, entier).
 * TODO(decision) : multiples de 500 uniquement, ou tout entier >= 200 ?
 */
export const MISE_MINIMALE = 200;

/** Pas d'ajustement des boutons +/− du sélecteur de mise. */
export const PAS_MISE = 500;

/** Puces rapides du sélecteur de mise. */
export const PUCES_MISE = [500, 1000, 2500, 5000, 10000] as const;

/** Chaque cycle (mois) compte 31 jours de paiement. */
export const TOTAL_JOURS_CYCLE = 31;

/** Moyen de paiement Mobile Money affiché. */
export const MOYEN_PAIEMENT = "MTN Mobile Money";

/** Mention FedaPay affichée sur les paiements. */
export const MENTION_FRAIS_FEDAPAY = "Les frais FedaPay sont à votre charge.";

/** Délai maximum d'une requête réseau (ms). */
export const DELAI_TIMEOUT_REQUETE_MS = 20000;

/** Polling du statut d'une transaction : intervalle (ms). */
export const POLLING_TRANSACTION_INTERVAL_MS = 3000;

/** Polling du statut d'une transaction : durée maximum (ms), ici 2 minutes. */
export const POLLING_TRANSACTION_DUREE_MAX_MS = 120000;

/** Décalage horaire du Bénin (UTC+1, sans heure d'été), en minutes. */
export const OFFSET_BENIN_MINUTES = 60;

/** Préfixe téléphonique international du Bénin. */
export const PREFIXE_TELEPHONE = "229";

/**
 * Nombre de chiffres locaux d'un numéro béninois (sans le préfixe 229).
 * Tous les numéros béninois commencent par "01" : 10 chiffres locaux.
 * Le numéro complet envoyé à l'API = PREFIXE_TELEPHONE + 10 chiffres = 13 chiffres.
 */
export const LONGUEUR_TELEPHONE_LOCAL = 10;

/** Délai simulé en mode démo pour laisser apparaître les squelettes (ms). */
export const DELAI_DEMO_MS = 450;
