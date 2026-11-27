/**
 * Formate un taux en pourcentage lu du serveur, à la française.
 * 2.75 -> "2,75" ; 5 -> "5" ; "2.7500" -> "2,75".
 * Si le taux est absent ou illisible, renvoie "—" (jamais "undefined").
 */
export function formaterTaux(taux: number | string | null | undefined): string {
  if (taux === null || taux === undefined || String(taux).trim() === "") {
    return "—";
  }
  const n = Number(String(taux).replace("%", "").replace(",", ".").trim());
  if (Number.isNaN(n)) return "—";
  return String(n).replace(".", ",");
}