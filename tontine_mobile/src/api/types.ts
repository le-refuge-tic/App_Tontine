// Types des réponses de l'API, alignés sur les entités du backend NestJS.
// Les routes findAll du membre connecté renvoient les champs "plats" ci-dessous
// (les relations ne sont pas chargées par défaut côté serveur).

export type Regularite = "jour" | "semaine" | "mois";

/** Résultat de GET /rapport?mois=AAAA-MM&type=... */
export interface RapportMensuel {
  mois: string;
  ecritures: EcritureComptable[];
  totaux: {
    cotise: number;
    retire: number;
    fondsRetenu: number;
    /** Total épargné (dépôts d'épargne) sur le mois. */
    epargneDepose?: number;
    /** Total retiré d'épargne sur le mois. */
    epargneRetire?: number;
  };
}
export type StatutSouscription = "active" | "cloturee";
export type StatutCycle = "en_cours" | "termine";
export type StatutJourCotisation = "a_payer" | "paye" | "perdu" | "rattrape";
export type TypeTransaction = "depot" | "retrait";
export type StatutTransaction = "en_attente" | "reussi" | "echoue";
export type SensEcriture = "credit" | "debit";
export type TypeEcriture =
  | "cotisation"
  | "fonds_caisse"
  | "retrait"
  | "epargne"
  | "retrait_epargne"
  | "penalite"
  | "retenue_epargne"
  | "interet"
  | "gage_bloque"
  | "gage_libere"
  | "gage_preleve"
  | "pret_octroye"
  | "remboursement";
export type TypeNotification = "rappel_paiement" | "retrait_effectue";
export type Role = "membre" | "admin";
export type StatutMembre = "actif" | "suspendu" | "cloture";

export interface Membre {
  id: number;
  nom: string;
  phone: string;
  role: Role;
  statut: StatutMembre;
  dateInscription: string; // ISO UTC
}

export interface Souscription {
  id: number;
  miseBase: number;
  regularite: Regularite;
  prochaineMiseBase: number | null;
  prochaineRegularite: Regularite | null;
  dateDemarrage: string; // AAAA-MM-JJ
  statut: StatutSouscription;
}

export interface Cycle {
  id: number;
  numero: number;
  miseBase: number;
  regularite: Regularite;
  dateDebut: string; // AAAA-MM-JJ
  dateFin: string;
  fondsCaisseRetenu: number;
  statut: StatutCycle;
}

export interface CycleAvecJours extends Cycle {
  jours: JourCotisation[];
}

export interface JourCotisation {
  id: number;
  numeroJour: number;
  datePrevue: string; // AAAA-MM-JJ
  coefficient: number;
  montantDu: number;
  montantPaye: number;
  statut: StatutJourCotisation;
}

export interface Portefeuille {
  id: number;
  soldeCotisation: number;
  soldeEpargne: number;
  soldeBloque: number;
}

/** Vue agrégée renvoyée par GET /portefeuilles/moi (calculs côté serveur). */
export interface PortefeuilleVue {
  soldeCotisation: number;
  soldeEpargne: number;
  soldeBloque: number;
  fondsCaisseRetenu: number;
  retirable: number;
}

export interface Transaction {
  id: number;
  type: TypeTransaction;
  montant: number;
  fraisFedapay: number;
  referenceUnique: string;
  idFedapay: string | null;
  statut: StatutTransaction;
  dateOperation: string; // ISO UTC
}

export interface EcritureComptable {
  id: number;
  type: TypeEcriture;
  montant: number;
  sens: SensEcriture;
  description: string;
  date: string; // ISO UTC
  /** Nom du projet d'épargne si l'écriture est liée à une épargne. Null sinon. */
  projetNom?: string | null;
}

export interface Notification {
  id: number;
  type: TypeNotification;
  message: string;
  lue: boolean;
  date: string; // ISO UTC
}

// ── Épargne / Projet ──────────────────────────────────────────────────────

export type StatutEpargne = "active" | "retiree" | "cloturee";

/** Aperçu indicatif renvoyé par le serveur dans chaque EpargneVue. */
export interface ApercuEpargne {
  penaliteSiRetraitMaintenant: number;
  tauxApplicable: number;
  netEstime: number;
  /** Vrai si l'objectif est atteint (objectifAtteintLe non null ou montant ≥ objectif). */
  objectifAtteint: boolean;
  /** Montant restant à épargner pour atteindre l'objectif (0 si déjà atteint). */
  resteAAtteindre: number;
}

/** Vue d'une épargne (projet) telle que renvoyée par GET /epargnes et GET /epargnes/:id. */
export interface EpargneVue {
  id: number;
  montant: number;
  /** Toujours null pour les nouveaux projets. Ne plus afficher. */
  dateEcheance: string | null;
  statut: StatutEpargne;
  nom: string;
  /** Montant cible (FCFA, > 0). Obligatoire depuis le prompt M2b. */
  objectifMontant: number;
  /**
   * Date à laquelle l'objectif a été atteint pour la première fois.
   * Null tant que l'objectif n'est pas atteint.
   */
  objectifAtteintLe: string | null; // ISO UTC
  /** Progression vers l'objectif (0–100). Fourni par le serveur. */
  progressionPourcent: number;
  apercu: ApercuEpargne;
}

/** Résultat de POST /epargnes. */
export interface ResultatCreationEpargne {
  epargne: EpargneVue;
  transaction: Transaction;
  urlPaiement: string | null;
}

/** Résultat de POST /epargnes/:id/depots. */
export interface ResultatDepotEpargne {
  transaction: Transaction;
  urlPaiement: string | null;
}

/**
 * Jour rattrapable tel que renvoyé par GET /cycles/jours-rattrapables.
 * Différent de JourCotisation : contient un champ `cycle` imbriqué.
 */
export interface JourRattrapable {
  id: number;
  numeroJour: number;
  datePrevue: string;
  coefficient: number;
  montantDu: number;
  montantPaye: number;
  statut: StatutJourCotisation;
  cycle: {
    id: number;
    numero: number;
    dateDebut: string;
    dateFin: string;
  };
}

export interface PaireJetons {
  accessToken: string;
  refreshToken: string;
}

export interface ResultatAuth extends PaireJetons {
  membre: Membre;
}

/**
 * Vue agrégée du portefeuille affichée sur l'accueil. Désormais fournie
 * directement par GET /portefeuilles/moi ; `retirable` est toujours un number.
 */
export interface TableauDeBord {
  soldeCotisation: number;
  soldeEpargne: number;
  soldeBloque: number;
  fondsCaisseRetenu: number;
  retirable: number;
}
