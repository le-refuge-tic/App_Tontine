import { OFFSET_BENIN_MINUTES } from "@/constants/app";
import { EST_MODE_DEMO, DEMO_MAINTENANT_ISO } from "@/constants/env";

const MOIS_COURTS = [
  "janv", "févr", "mars", "avr", "mai", "juin",
  "juil", "août", "sept", "oct", "nov", "déc",
];
const MOIS_LONGS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const JOURS_COURTS = ["dim", "lun", "mar", "mer", "jeu", "ven", "sam"];

export interface ComposantsDate {
  annee: number;
  mois: number; // 0-11
  jour: number; // 1-31
  heure: number; // 0-23
  minute: number; // 0-59
  seconde: number; // 0-59
  js: number; // 0=dimanche ... 6=samedi
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

/** Convertit un instant en composants à l'heure du Bénin (UTC+1, sans été). */
function enBenin(instant: Date): ComposantsDate {
  const d = new Date(instant.getTime() + OFFSET_BENIN_MINUTES * 60 * 1000);
  return {
    annee: d.getUTCFullYear(),
    mois: d.getUTCMonth(),
    jour: d.getUTCDate(),
    heure: d.getUTCHours(),
    minute: d.getUTCMinutes(),
    seconde: d.getUTCSeconds(),
    js: d.getUTCDay(),
  };
}

/** Instant « maintenant » à l'heure du Bénin (figé en mode démo). */
export function maintenantBenin(): Date {
  return EST_MODE_DEMO ? new Date(DEMO_MAINTENANT_ISO) : new Date();
}

/** Composants de « maintenant » à l'heure du Bénin. */
export function maintenantComposants(): ComposantsDate {
  return enBenin(maintenantBenin());
}

/** Convertit une date ISO (UTC) en composants à l'heure du Bénin. */
export function composantsDepuisIso(iso: string): ComposantsDate {
  return enBenin(new Date(iso));
}

/** Date du jour au Bénin au format AAAA-MM-JJ (comparable aux datePrevue). */
export function dateJourBeninISO(): string {
  const c = maintenantComposants();
  return `${c.annee}-${pad2(c.mois + 1)}-${pad2(c.jour)}`;
}

/** Numéro de jour dans le mois « aujourd'hui » au Bénin. */
export function jourAujourdhuiNumero(): number {
  return maintenantComposants().jour;
}

/** "12 nov" */
export function formaterDateCourte(iso: string): string {
  const c = composantsDepuisIso(iso);
  return `${c.jour} ${MOIS_COURTS[c.mois]}`;
}

/** "Novembre 2026" (depuis une ISO ou des composants {annee, mois}). */
export function formaterMoisAnnee(args: { annee: number; mois: number } | string): string {
  const c = typeof args === "string" ? composantsDepuisIso(args) : args;
  return `${MOIS_LONGS[c.mois]} ${c.annee}`;
}

/** "jeu. 12 nov" */
export function formaterJourDateCourte(iso: string): string {
  const c = composantsDepuisIso(iso);
  return `${JOURS_COURTS[c.js]}. ${c.jour} ${MOIS_COURTS[c.mois]}`;
}

/** "12 nov, 14:30" */
export function formaterDateHeure(iso: string): string {
  const c = composantsDepuisIso(iso);
  return `${c.jour} ${MOIS_COURTS[c.mois]}, ${pad2(c.heure)}:${pad2(c.minute)}`;
}

/** "14:30" */
export function formaterHeure(iso: string): string {
  const c = composantsDepuisIso(iso);
  return `${pad2(c.heure)}:${pad2(c.minute)}`;
}

/**
 * Relatif lisible : "à l'instant", "il y a 5 min", "il y a 2 h", "hier",
 * "il y a 3 jours", sinon "12 nov". Basé sur les jours calendaires du Bénin.
 */
export function formaterRelatif(iso: string): string {
  const cCible = composantsDepuisIso(iso);
  const cNow = maintenantComposants();
  const ordNow = Date.UTC(cNow.annee, cNow.mois, cNow.jour);
  const ordCible = Date.UTC(cCible.annee, cCible.mois, cCible.jour);
  const diffJours = Math.round((ordNow - ordCible) / 86_400_000);

  if (diffJours === 0) {
    const diffSec = Math.round((maintenantBenin().getTime() - new Date(iso).getTime()) / 1000);
    if (diffSec < 45) return "à l'instant";
    if (diffSec < 90) return "il y a 1 min";
    if (diffSec < 3600) return `il y a ${Math.floor(diffSec / 60)} min`;
    return `il y a ${Math.floor(diffSec / 3600)} h`;
  }
  if (diffJours === 1) return "hier";
  if (diffJours > 0 && diffJours < 7) return `il y a ${diffJours} jours`;
  return formaterDateCourte(iso);
}
