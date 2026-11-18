// Types des réponses de l'API, alignés sur les entités du backend NestJS.
// Les routes findAll du membre connecté renvoient les champs "plats" ci-dessous
// (les relations ne sont pas chargées par défaut côté serveur).

export type Regularite = "jour" | "semaine" | "mois";
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
}

export interface Notification {
  id: number;
  type: TypeNotification;
  message: string;
  lue: boolean;
  date: string; // ISO UTC
}

export interface PaireJetons {
  accessToken: string;
  refreshToken: string;
}

export interface ResultatAuth extends PaireJetons {
  membre: Membre;
}

/**
 * Vue agrégée du portefeuille affichée sur l'accueil. `retirable` vaut null
 * tant que la route correspondante n'existe pas côté backend (TODO backend).
 */
export interface TableauDeBord {
  soldeCotisation: number;
  soldeEpargne: number;
  soldeBloque: number;
  fondsCaisseRetenu: number;
  retirable: number | null;
}
