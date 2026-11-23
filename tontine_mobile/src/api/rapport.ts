import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, ecrituresDemo } from "./fixtures";
import { requete } from "./client";
import type { RapportMensuel } from "./types";

type FiltreRapport = "tout" | "cotisations" | "retraits";

/**
 * GET /rapport?mois=AAAA-MM&type=tout|cotisations|retraits
 *
 * Renvoie { mois, ecritures[], totaux: { cotise, retire, fondsRetenu } }.
 * Les totaux sont calculés côté serveur ; le mobile les affiche tels quels.
 */
export async function obtenirRapport(
  mois: string,
  type: FiltreRapport = "tout",
): Promise<RapportMensuel> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    const ecritures = ecrituresDemo.filter((e) => {
      if (type === "cotisations") return e.type === "cotisation";
      if (type === "retraits") return e.type === "retrait" || e.type === "retrait_epargne";
      return true;
    });
    const cotise = ecritures
      .filter((e) => e.sens === "credit" && e.type === "cotisation")
      .reduce((s, e) => s + e.montant, 0);
    const retire = ecritures
      .filter((e) => e.sens === "debit" && e.type === "retrait")
      .reduce((s, e) => s + e.montant, 0);
    const fondsRetenu = ecritures
      .filter((e) => e.type === "fonds_caisse")
      .reduce((s, e) => s + e.montant, 0);
    return { mois, ecritures, totaux: { cotise, retire, fondsRetenu } };
  }

  const params = new URLSearchParams({ mois, type });
  return requete<RapportMensuel>(`/rapport?${params.toString()}`);
}
