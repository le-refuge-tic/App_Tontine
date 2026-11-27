import { DELAI_DEMO_MS } from "@/constants/app";
import type {
  CycleAvecJours,
  EcritureComptable,
  EpargneVue,
  JourCotisation,
  JourRattrapable,
  Membre,
  Notification,
  Portefeuille,
  Souscription,
  StatutJourCotisation,
  TableauDeBord,
  Transaction,
} from "./types";

/** Attend un court instant en mode démo pour laisser apparaître les squelettes. */
export function delaiDemo(ms: number = DELAI_DEMO_MS): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

// ── Membre : Koffi Adjovi ──────────────────────────────────────────────────
export const membreDemo: Membre = {
  id: 1,
  nom: "Koffi Adjovi",
  phone: "2290197000000",
  role: "membre",
  statut: "actif",
  dateInscription: "2025-09-03T08:15:00Z",
};

// ── Souscription active : 500 F / jour ─────────────────────────────────────
export const souscriptionDemo: Souscription = {
  id: 1,
  miseBase: 500,
  regularite: "jour",
  prochaineMiseBase: null,
  prochaineRegularite: null,
  dateDemarrage: "2026-11-01",
  statut: "active",
};

// ── Carnnet du mois : 30 jours pour novembre (30 j), un jour doublé (×2) ────
export function fabriquerJoursDemo(): JourCotisation[] {
  const jours: JourCotisation[] = [];
  for (let n = 1; n <= 30; n++) {
    const datePrevue = `2026-11-${pad2(n)}`;
    let statut: StatutJourCotisation = "a_payer";
    let coefficient = 1;
    let montantPaye = 0;

    if (n === 1) {
      statut = "paye";
      montantPaye = 500;
    } else if (n === 2) {
      statut = "paye";
      coefficient = 2; // jour doublé
      montantPaye = 1000;
    } else if (n >= 3 && n <= 11) {
      statut = "perdu";
    }
    // n === 12 : aujourd'hui (à payer). n >= 13 : à payer.

    jours.push({
      id: n,
      numeroJour: n,
      datePrevue,
      coefficient,
      montantDu: coefficient * 500,
      montantPaye,
      statut,
    });
  }
  return jours;
}

// ── Cycle en cours : novembre 2026 ─────────────────────────────────────────
export const cycleDemo: CycleAvecJours = {
  id: 1,
  numero: 1,
  miseBase: 500,
  regularite: "jour",
  dateDebut: "2026-11-01",
  dateFin: "2026-11-30",
  fondsCaisseRetenu: 500,
  statut: "en_cours",
  jours: fabriquerJoursDemo(),
};

// ── Portefeuille ──────────────────────────────────────────────────────────
// soldeCotisation = 1 000 (jour 1 + jour 2 cotisés), fonds de caisse = 500.
export const portefeuilleDemo: Portefeuille = {
  id: 1,
  soldeCotisation: 1000,
  soldeEpargne: 0,
  soldeBloque: 0,
};

export const tableauDeBordDemo: TableauDeBord = {
  soldeCotisation: 1000,
  soldeEpargne: 0,
  soldeBloque: 0,
  fondsCaisseRetenu: 500,
  retirable: 1000,
};

// ── Écritures comptables (dernières opérations + rapport) ──────────────────
// Mise de base : 500 F.
// 1er novembre (1er dépôt du cycle) : 500 F déposés.
//   → écriture cotisation +500 F
//   → écriture fonds_caisse −500 F (retenu une seule fois, = 1 mise de base)
//   → solde cotisé net du jour 1 : 0 F (tout est retenu)
// 2 novembre (2ème dépôt, jour ×2, coefficient 2) : 1 000 F déposés.
//   → écriture cotisation +1 000 F (aucune retenue sur les dépôts suivants)
// Résultat : soldeCotisation = 1 000, fondsCaisseRetenu = 500, retirable = 1 000.
export const ecrituresDemo: EcritureComptable[] = [
  {
    id: 101,
    type: "cotisation",
    montant: 500,
    sens: "credit",
    description: "Cotisation — 1er novembre",
    date: "2026-11-01T07:32:00Z",
  },
  {
    id: 102,
    type: "fonds_caisse",
    montant: 500,
    sens: "debit",
    description: "Fonds de caisse retenu — 1er novembre (1 mise de base)",
    date: "2026-11-01T07:32:01Z",
  },
  {
    id: 103,
    type: "cotisation",
    montant: 1000,
    sens: "credit",
    description: "Cotisation — 2 novembre (jour ×2)",
    date: "2026-11-02T07:28:00Z",
  },
  {
    id: 104,
    type: "epargne",
    montant: 25000,
    sens: "credit",
    description: "Dépôt épargne — 3 novembre",
    date: "2026-11-03T09:10:00Z",
    projetNom: "Achat moto",
  },
];

// ── Notifications ──────────────────────────────────────────────────────────
export const notificationsDemo: Notification[] = [
  {
    id: 1,
    type: "rappel_paiement",
    message: "N'oubliez pas votre cotisation d'aujourd'hui (12 nov).",
    lue: false,
    date: "2026-11-12T05:30:00Z",
  },
  {
    id: 2,
    type: "rappel_paiement",
    message: "Vous avez 9 jours de cotisation en retard. Rattrapez-les quand vous voulez.",
    lue: false,
    date: "2026-11-10T18:00:00Z",
  },
  {
    id: 3,
    type: "retrait_effectue",
    message: "Votre retrait de 5 000 F a été envoyé sur MTN Mobile Money.",
    lue: true,
    date: "2026-11-05T10:00:00Z",
  },
];

// ── Transactions (démo) ────────────────────────────────────────────────────
// Magasin d'état simple pour simuler la transition en_attente -> reussi.
const etatsTransactions = new Map<
  number,
  { tentatives: number; montant: number; type: "depot" | "retrait" }
>();

function fabriqueTransaction(
  id: number,
  montant: number,
  type: "depot" | "retrait",
  statut: "en_attente" | "reussi" | "echoue",
): Transaction {
  return {
    id,
    type,
    montant,
    fraisFedapay: 0,
    referenceUnique: `DEMO-${id}`,
    idFedapay: null,
    statut,
    dateOperation: new Date().toISOString(),
  };
}

/** Enregistre une transaction démo en attente et renvoie son état initial. */
export function enregistrerTransactionDemo(
  id: number,
  montant: number,
  type: "depot" | "retrait",
): Transaction {
  etatsTransactions.set(id, { tentatives: 0, montant, type });
  return fabriqueTransaction(id, montant, type, "en_attente");
}

/** Renvoie le prochain état de la transaction démo (en_attente puis reussi). */
export function prochaineTransactionDemo(id: number): Transaction | null {
  const etat = etatsTransactions.get(id);
  if (!etat) return null;
  etat.tentatives += 1;
  etatsTransactions.set(id, etat);
  return fabriqueTransaction(id, etat.montant, etat.type, etat.tentatives >= 2 ? "reussi" : "en_attente");
}

// ── Jours rattrapables (démo) ─────────────────────────────────────────────
// Les jours 3 à 11 du cycle démo sont « perdu » (voir fabriquerJoursDemo).
export function fabriquerJoursRattrapablesDemo(): JourRattrapable[] {
  const jours = fabriquerJoursDemo();
  return jours
    .filter((j) => j.statut === "perdu")
    .map((j): JourRattrapable => ({
      ...j,
      cycle: {
        id: cycleDemo.id,
        numero: cycleDemo.numero,
        dateDebut: cycleDemo.dateDebut,
        dateFin: cycleDemo.dateFin,
      },
    }));
}

// ── Épargnes / Projets (démo) ─────────────────────────────────────────────
// Magasin mutable pour simuler création, dépôt, modification.
let _prochainIdEpargne = 3;

const _epargnesMap = new Map<number, EpargneVue>([
  [
    1,
    {
      id: 1,
      nom: "Achat moto",
      montant: 25000,
      dateEcheance: null,
      statut: "active",
      objectifMontant: 100000,
      objectifAtteintLe: null,
      progressionPourcent: 25,
      apercu: {
        penaliteSiRetraitMaintenant: 1250,
        tauxApplicable: 5,
        netEstime: 23750,
        objectifAtteint: false,
        resteAAtteindre: 75000,
      },
    },
  ],
  [
    2,
    {
      id: 2,
      nom: "Fête de fin d'année",
      montant: 50000,
      dateEcheance: null,
      statut: "active",
      objectifMontant: 50000,
      objectifAtteintLe: "2026-11-03T09:10:00Z",
      progressionPourcent: 100,
      apercu: {
        penaliteSiRetraitMaintenant: 1375,
        tauxApplicable: 2.75,
        netEstime: 48625,
        objectifAtteint: true,
        resteAAtteindre: 0,
      },
    },
  ],
]);

export function epargnesDemoListe(): EpargneVue[] {
  return Array.from(_epargnesMap.values());
}

export function epargnesDemoMap(): Map<number, EpargneVue> {
  return _epargnesMap;
}

export function prochainIdEpargneDemo(): number {
  return _prochainIdEpargne++;
}
