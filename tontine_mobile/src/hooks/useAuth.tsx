import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { auth, getRefreshToken, getAccessToken, effacerJetons, definirRappelSessionPerdue } from "@/api";
import { EST_MODE_DEMO } from "@/constants/env";
import { membreDemo } from "@/api/fixtures";
import type { Membre } from "@/api/types";

/**
 * État de la session :
 * - "chargement" : lecture locale des jetons en cours (expo-secure-store).
 *   Aucune redirection ni rendu d'écran tant que cet état persiste.
 * - "connecte"   : un membre est authentifié (jetons locaux présents ou
 *   connexion/inscription réussie). La validation réseau peut encore être
 *   en cours en arrière-plan.
 * - "deconnecte" : pas de jeton local valide, ou session révoquée.
 */
export type EtatSession = "chargement" | "connecte" | "deconnecte";

interface AuthContextType {
  membre: Membre | null;
  etatSession: EtatSession;
  /** @deprecated Utiliser etatSession === "connecte" */
  estAuthentifie: boolean;
  /** @deprecated Utiliser etatSession === "chargement" */
  estEnChargement: boolean;
  seConnecter: (params: { phone: string; password: string }) => Promise<void>;
  sInscrire: (params: { nom: string; phone: string; password: string }) => Promise<void>;
  seDeconnecter: () => Promise<void>;
  rafraichirMembre: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [membre, setMembre] = useState<Membre | null>(null);
  const [etatSession, setEtatSession] = useState<EtatSession>("chargement");

  const perdreSession = useCallback(() => {
    setMembre(null);
    setEtatSession("deconnecte");
  }, []);

  useEffect(() => {
    definirRappelSessionPerdue(perdreSession);
  }, [perdreSession]);

  // Restauration de session au montage.
  useEffect(() => {
    let actif = true;

    void (async () => {
      // Mode démo : connecté immédiatement, pas de réseau.
      if (EST_MODE_DEMO) {
        if (actif) {
          setMembre(membreDemo);
          setEtatSession("connecte");
        }
        return;
      }

      // 1. Lecture locale des jetons (expo-secure-store, synchrone via getItem
      //    ou rapide via getItemAsync).
      const refreshToken = await getRefreshToken();

      if (!refreshToken) {
        // Aucun jeton stocké : déconnecté, pas besoin de réseau.
        if (actif) setEtatSession("deconnecte");
        return;
      }

      // 2. Jeton présent : on déclare l'utilisateur "connecté" immédiatement
      //    pour éviter le flash de l'écran de connexion. Le Stack s'affiche
      //    avec les squelettes pendant que la validation réseau se fait.
      if (actif) setEtatSession("connecte");

      // 3. Validation réseau en arrière-plan (GET /auth/moi, avec rafraîchissement
      //    automatique si le accessToken est expiré).
      try {
        const moi = await auth.obtenirMoi();
        if (actif) setMembre(moi);
      } catch {
        // GET /auth/moi a échoué même après tentative de rafraîchissement.
        // Deux cas possibles :
        // a) Pas de réseau : on garde etatSession = "connecte" et membre = null.
        //    L'utilisateur verra les squelettes et pourra réessayer.
        // b) Jetons définitivement invalides (détectés par le client fetch qui
        //    appelle déjà perdreSession via definirRappelSessionPerdue).
        //    Dans ce cas perdreSession a déjà mis etatSession = "deconnecte".
        //
        // On ne force pas la déconnexion ici pour ne pas déconnecter sur une
        // simple coupure réseau temporaire.
      }
    })();

    return () => {
      actif = false;
    };
  }, []);

  const seConnecter = useCallback(async (params: { phone: string; password: string }) => {
    const res = await auth.connecter(params);
    setMembre(res.membre);
    setEtatSession("connecte");
  }, []);

  const sInscrire = useCallback(
    async (params: { nom: string; phone: string; password: string }) => {
      const res = await auth.inscrire(params);
      setMembre(res.membre);
      setEtatSession("connecte");
    },
    [],
  );

  const seDeconnecter = useCallback(async () => {
    if (!EST_MODE_DEMO) {
      const refresh = await getRefreshToken();
      if (refresh) {
        await auth.deconnecter(refresh).catch(() => {});
      } else {
        await effacerJetons();
      }
    }
    setMembre(null);
    setEtatSession("deconnecte");
  }, []);

  const rafraichirMembre = useCallback(async () => {
    const moi = await auth.obtenirMoi();
    setMembre(moi);
  }, []);

  const value = useMemo<AuthContextType>(
    () => ({
      membre,
      etatSession,
      estAuthentifie: etatSession === "connecte",
      estEnChargement: etatSession === "chargement",
      seConnecter,
      sInscrire,
      seDeconnecter,
      rafraichirMembre,
    }),
    [membre, etatSession, seConnecter, sInscrire, seDeconnecter, rafraichirMembre],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans un AuthProvider");
  return ctx;
}
