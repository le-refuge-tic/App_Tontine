/**
 * Tous les libellés visibles par l'utilisateur sont définis ici.
 * Pour en changer un, modifiez uniquement ce fichier.
 */

// ── Général ────────────────────────────────────────────────────────────────
export const LIB_FONDS_CAISSE = "Fonds verrouillé";
export const LIB_VERROUILLE = "verrouillé";   // jamais "retenu"

// ── Cotiser ────────────────────────────────────────────────────────────────
export const LIB_JOURS_A_RATTRAPER = "Jours à rattraper";
export const LIB_AUCUN_JOUR_A_RATTRAPER = "Aucun jour à rattraper";
export const LIB_JOURS_SELECTIONNES = "Jours sélectionnés";
export const LIB_TOTAL_RATTRAPAGE = "Total à payer";
export const LIB_PERDU_RATTRAPABLE = "perdu — rattrapable";
export const LIB_RATTRAPER_SELECTION = "Sélectionnez les jours à rattraper";

// ── Projets (épargne) ─────────────────────────────────────────────────────
export const LIB_PROJETS = "Projets";
export const LIB_NOUVEAU_PROJET = "Nouveau projet";
export const LIB_NOM_PROJET = "Nom du projet";
export const LIB_OBJECTIF = "Objectif (FCFA)";
export const LIB_OBJECTIF_AIDE = "Choisis le montant que tu veux atteindre";
export const LIB_MONTANT_INITIAL = "Premier dépôt (FCFA)";
export const LIB_MONTANT_DEPOT = "Montant à ajouter (FCFA)";
export const LIB_DEPOSER = "Déposer";
export const LIB_MODIFIER_PROJET = "Modifier le projet";
export const LIB_RETIRER_PROJET = "Retirer";
export const LIB_RETIRER_BIENTOT = "Bientôt disponible";
export const LIB_AUCUN_PROJET = "Aucun projet";
export const LIB_AUCUN_PROJET_MSG = "Créez votre premier projet d'épargne.";

export const LIB_STATUT_ACTIF = "Actif";
export const LIB_STATUT_RETIRE = "Retiré";
export const LIB_STATUT_CLOTURE = "Clôturé";

export const LIB_PROGRESSION = "Progression";
export const LIB_OBJECTIF_COURT = "Objectif";
export const LIB_MONTANT_EPARGNE = "Montant épargné";
export const LIB_RESTE_A_ATTEINDRE = "Reste à atteindre";
export const LIB_OBJECTIF_ATTEINT_BADGE = "Objectif atteint ✓";

export const LIB_APERCU_TITRE = "Aperçu du retrait";
export const LIB_APERCU_MENTION = "Estimation, peut évoluer.";
/** Utilisé dans l'aperçu retrait quand l'objectif est atteint. */
export const LIB_APERCU_RETRAIT_ATTEINT = (taux: string) =>
  `Si tu retires maintenant : frais de ${taux} % (objectif atteint)`;
export const LIB_APERCU_RETRAIT_NON_ATTEINT = (taux: string) =>
  `Si tu retires maintenant : pénalité de ${taux} % (objectif non atteint)`;
export const LIB_FRAIS_RETRAIT = "Frais si retrait maintenant";
export const LIB_PENALITE = "Pénalité si retrait maintenant";
export const LIB_TAUX = "Taux applicable";
export const LIB_NET_ESTIME = "Net estimé";
/** Libellé dans le rapport pour une écriture de type pénalité (objectif non atteint). */
export const LIB_PENALITE_RAPPORT = "Pénalité : objectif non atteint";
export const LIB_OBJECTIF_NON_MODIFIABLE = "L'objectif ne peut plus être modifié après un premier dépôt";

export const LIB_PROJET_CREE = "Projet créé";
export const LIB_PROJET_CREE_ZERO =
  "Le paiement n'a pas abouti. Votre projet a été créé avec un solde de 0 FCFA. Vous pouvez y déposer de l'argent dès maintenant.";
export const LIB_DEPOT_REUSSI = "Dépôt réussi";
export const LIB_MODIF_REUSSIE = "Modifications enregistrées";
