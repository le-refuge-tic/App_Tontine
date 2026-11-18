import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { auth, cycles, depots, ecritures, notifications, retraits, souscriptions, tableauBord } from "@/api";
import type { Regularite } from "@/api/types";
import { useAuth } from "./useAuth";

export const clesRequetes = {
  moi: ["auth", "moi"] as const,
  souscriptionActive: ["souscription", "active"] as const,
  tableauBord: ["tableauBord"] as const,
  cycleEnCours: ["cycle", "enCours"] as const,
  ecritures: ["ecritures"] as const,
  notifications: ["notifications"] as const,
};

// ── Lecture ────────────────────────────────────────────────────────────────

export function useTableauDeBord() {
  const { estAuthentifie } = useAuth();
  return useQuery({
    queryKey: clesRequetes.tableauBord,
    queryFn: () => tableauBord.obtenirTableauDeBord(),
    enabled: estAuthentifie,
  });
}

export function useCycleEnCours() {
  const { estAuthentifie } = useAuth();
  return useQuery({
    queryKey: clesRequetes.cycleEnCours,
    queryFn: () => cycles.obtenirCycleEnCours(),
    enabled: estAuthentifie,
  });
}

export function useEcritures() {
  const { estAuthentifie } = useAuth();
  return useQuery({
    queryKey: clesRequetes.ecritures,
    queryFn: () => ecritures.listerEcritures(),
    enabled: estAuthentifie,
  });
}

export function useNotifications() {
  const { estAuthentifie } = useAuth();
  return useQuery({
    queryKey: clesRequetes.notifications,
    queryFn: () => notifications.listerNotifications(),
    enabled: estAuthentifie,
  });
}

/** État de la souscription active pour la redirection : "inconnu" | "oui" | "non". */
export function useEtatSouscription(): "inconnu" | "oui" | "non" {
  const { estAuthentifie } = useAuth();
  const q = useQuery({
    queryKey: clesRequetes.souscriptionActive,
    queryFn: () => souscriptions.obtenirSouscriptionActive(),
    enabled: estAuthentifie,
  });
  // "inconnu" pendant toute la durée du chargement OU d'un refetch :
  // évite une redirection vers choisir-mise pendant le refetch qui suit la création.
  if (q.isPending || q.isFetching || q.isError || q.data === undefined) return "inconnu";
  return q.data === null ? "non" : "oui";
}

// ── Écritures ──────────────────────────────────────────────────────────────

/** Invalide toutes les requêtes dépendant des données du membre (après un paiement/retrait). */
export function useInvaliderDonnees() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: clesRequetes.tableauBord });
    void qc.invalidateQueries({ queryKey: clesRequetes.cycleEnCours });
    void qc.invalidateQueries({ queryKey: clesRequetes.ecritures });
    void qc.invalidateQueries({ queryKey: clesRequetes.souscriptionActive });
  };
}

// ── Mutations ──────────────────────────────────────────────────────────────

export function useCreerSouscription() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { miseBase: number; regularite: Regularite; dateDemarrage: string }) =>
      souscriptions.creerSouscription(params),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clesRequetes.souscriptionActive });
    },
  });
}

export function useMarquerLue() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => notifications.marquerLue(id),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: clesRequetes.notifications });
    },
  });
}

export function useDefinirCodeRetrait() {
  return useMutation({
    mutationFn: (params: { password: string; codeRetrait: string }) => auth.definirCodeRetrait(params),
  });
}

export function useChangerPassword() {
  return useMutation({
    mutationFn: (params: { ancienPassword: string; nouveauPassword: string }) => auth.changerPassword(params),
  });
}

export function useVerifierCodeRetrait() {
  return useMutation({
    mutationFn: (code: string) => auth.verifierCodeRetrait(code),
  });
}

export function useLancerDepot() {
  const invalider = useInvaliderDonnees();
  return useMutation({
    mutationFn: (jourIds: number[]) => depots.lancerDepot(jourIds),
    onSuccess: () => invalider(),
  });
}

export function useDemanderRetrait() {
  const invalider = useInvaliderDonnees();
  return useMutation({
    mutationFn: (params: { montant?: number; total?: boolean; jetonRetrait: string }) =>
      retraits.demanderRetrait(params),
    onSuccess: () => invalider(),
  });
}
