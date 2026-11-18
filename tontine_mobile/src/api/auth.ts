import { EST_MODE_DEMO } from "@/constants/env";
import { delaiDemo, membreDemo } from "./fixtures";
import { requete } from "./client";
import { setJetons, effacerJetons } from "./jetons";
import type { Membre, ResultatAuth } from "./types";

/** POST /auth/inscription — crée le membre, émet la paire de jetons. */
export async function inscrire(params: { nom: string; phone: string; password: string }): Promise<ResultatAuth> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return { membre: membreDemo, accessToken: "demo-access", refreshToken: "demo-refresh" };
  }
  const res = await requete<ResultatAuth>("/auth/inscription", {
    method: "POST",
    sansAuth: true,
    body: params,
  });
  await setJetons(res.accessToken, res.refreshToken);
  return res;
}

/** POST /auth/connexion — vérifie phone + password, émet la paire de jetons. */
export async function connecter(params: { phone: string; password: string }): Promise<ResultatAuth> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return { membre: membreDemo, accessToken: "demo-access", refreshToken: "demo-refresh" };
  }
  const res = await requete<ResultatAuth>("/auth/connexion", {
    method: "POST",
    sansAuth: true,
    body: params,
  });
  await setJetons(res.accessToken, res.refreshToken);
  return res;
}

/** POST /auth/deconnexion — révoque le jeton de rafraîchissement, puis efface localement. */
export async function deconnecter(refreshToken: string): Promise<void> {
  if (EST_MODE_DEMO) {
    await delaiDemo(200);
    return;
  }
  try {
    await requete<never>("/auth/deconnexion", { method: "POST", body: { refreshToken } });
  } finally {
    await effacerJetons();
  }
}

/** GET /auth/moi — membre connecté. */
export async function obtenirMoi(): Promise<Membre> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return membreDemo;
  }
  return requete<Membre>("/auth/moi");
}

/** POST /auth/changer-password — révoque tous les refresh tokens. */
export async function changerPassword(params: { ancienPassword: string; nouveauPassword: string }): Promise<void> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return;
  }
  await requete<never>("/auth/changer-password", { method: "POST", body: params });
}

/** POST /auth/code-retrait — définit ou change le code de retrait. */
export async function definirCodeRetrait(params: { password: string; codeRetrait: string }): Promise<void> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return;
  }
  await requete<never>("/auth/code-retrait", { method: "POST", body: params });
}

/** POST /auth/code-retrait/verifier — renvoie le jeton de retrait (texte brut). */
export async function verifierCodeRetrait(codeRetrait: string): Promise<string> {
  if (EST_MODE_DEMO) {
    await delaiDemo();
    return "jeton-de-retrait-demo";
  }
  return requete<string>("/auth/code-retrait/verifier", {
    method: "POST",
    body: { codeRetrait },
    brut: true,
  });
}
