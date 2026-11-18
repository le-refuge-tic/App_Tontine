import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, ecrituresDemo } from "./fixtures";
import { requete } from "./client";
import type { EcritureComptable } from "./types";

/** GET /ecritures-comptables — écritures du grand livre du membre. */
export async function listerEcritures(): Promise<EcritureComptable[]> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return ecrituresDemo;
  }
  return requete<EcritureComptable[]>("/ecritures-comptables");
}
