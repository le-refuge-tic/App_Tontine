import { EST_MODE_DEMO } from "@/constants/env";
import {
  delaiDemo,
  epargnesDemoListe,
  epargnesDemoMap,
  prochainIdEpargneDemo,
} from "./fixtures";
import { requete } from "./client";
import { preparerTransactionDemo } from "./transactions";
import type {
  EpargneVue,
  ResultatCreationEpargne,
  ResultatDepotEpargne,
} from "./types";

// ── Lecture ────────────────────────────────────────────────────────────────

/** GET /epargnes — liste des projets du membre connecté. */
export async function listerEpargnes(): Promise<EpargneVue[]> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return [...epargnesDemoListe()];
  }
  return requete<EpargneVue[]>("/epargnes");
}

/** GET /epargnes/:id — détail d'un projet. */
export async function obtenirEpargne(id: number): Promise<EpargneVue> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    const e = epargnesDemoMap().get(id);
    if (!e) throw new Error("Projet introuvable.");
    return e;
  }
  return requete<EpargneVue>(`/epargnes/${id}`);
}

// ── Création ───────────────────────────────────────────────────────────────

/** POST /epargnes — crée un projet et initie le premier dépôt. */
export async function creerEpargne(params: {
  nom: string;
  montantInitial: number;
  objectifMontant: number;
}): Promise<ResultatCreationEpargne> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    const id = prochainIdEpargneDemo();
    const epargne: EpargneVue = {
      id,
      nom: params.nom,
      montant: 0,
      dateEcheance: null,
      statut: "active",
      objectifMontant: params.objectifMontant,
      objectifAtteintLe: null,
      progressionPourcent: 0,
      apercu: {
        penaliteSiRetraitMaintenant: 0,
        tauxApplicable: 5,
        netEstime: 0,
        objectifAtteint: false,
        resteAAtteindre: params.objectifMontant,
      },
    };
    epargnesDemoMap().set(id, epargne);
    const transaction = preparerTransactionDemo(
      9100 + id,
      params.montantInitial,
      "depot",
    );
    return { epargne, transaction, urlPaiement: null };
  }
  return requete<ResultatCreationEpargne>("/epargnes", {
    method: "POST",
    body: params,
  });
}

// ── Dépôt additionnel ─────────────────────────────────────────────────────

/** POST /epargnes/:id/depots — ajoute de l'argent à un projet actif. */
export async function ajouterDepotEpargne(
  id: number,
  montant: number,
): Promise<ResultatDepotEpargne> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    const transaction = preparerTransactionDemo(9200 + id, montant, "depot");
    return { transaction, urlPaiement: null };
  }
  return requete<ResultatDepotEpargne>(`/epargnes/${id}/depots`, {
    method: "POST",
    body: { montant },
  });
}

// ── Modification ──────────────────────────────────────────────────────────

/** PATCH /epargnes/:id — modifie nom et/ou objectif d'un projet actif. */
export async function modifierEpargne(
  id: number,
  params: { nom?: string; objectifMontant?: number },
): Promise<EpargneVue> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    const map = epargnesDemoMap();
    const e = map.get(id);
    if (!e) throw new Error("Projet introuvable.");
    const nouvelObjectif =
      params.objectifMontant !== undefined ? params.objectifMontant : e.objectifMontant;
    const nouvelleProgression = Math.min(
      100,
      Math.floor((e.montant * 100) / nouvelObjectif),
    );
    const objectifAtteint = e.montant >= nouvelObjectif;
    const updated: EpargneVue = {
      ...e,
      nom: params.nom ?? e.nom,
      objectifMontant: nouvelObjectif,
      progressionPourcent: nouvelleProgression,
      apercu: {
        ...e.apercu,
        objectifAtteint,
        resteAAtteindre: Math.max(0, nouvelObjectif - e.montant),
        tauxApplicable: objectifAtteint ? 2.75 : 5,
      },
    };
    map.set(id, updated);
    return updated;
  }
  return requete<EpargneVue>(`/epargnes/${id}`, {
    method: "PATCH",
    body: params,
  });
}
