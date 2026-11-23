// Façade de la couche API. Toutes les fonctions basculent en mode démo
// (données fictives) si EXPO_PUBLIC_MODE_DEMO=true.

export * from "./types";
export { ErreurApi, definirRappelSessionPerdue, requete } from "./client";
export {
  getAccessToken,
  getRefreshToken,
  setJetons,
  effacerJetons,
} from "./jetons";

export * as auth from "./auth";
export * as souscriptions from "./souscriptions";
export * as cycles from "./cycles";
export * as portefeuille from "./portefeuille";
export * as tableauBord from "./tableauBord";
export * as transactions from "./transactions";
export * as ecritures from "./ecritures";
export * as notifications from "./notifications";
export * as depots from "./depots";
export * as retraits from "./retraits";
export * as rapport from "./rapport";
export * as dev from "./dev";
