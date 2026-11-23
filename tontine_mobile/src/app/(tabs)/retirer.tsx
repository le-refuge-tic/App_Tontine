import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ecran } from "@/components/Ecran";
import { Carte } from "@/components/Carte";
import { Champ } from "@/components/Champ";
import { Bouton } from "@/components/Bouton";
import { ClavierCode } from "@/components/ClavierCode";
import { FeuilleBasse } from "@/components/FeuilleBasse";
import { EtatErreur } from "@/components/EtatErreur";
import { Icone } from "@/components/Icone";
import { CarteSquelette } from "@/components/Squelette";
import { useToast } from "@/components/Toast";
import { theme } from "@/theme";
import { MOYEN_PAIEMENT, MENTION_FRAIS_FEDAPAY, POLLING_TRANSACTION_INTERVAL_MS, POLLING_TRANSACTION_DUREE_MAX_MS } from "@/constants/app";
import { useTableauDeBord, useVerifierCodeRetrait, useDemanderRetrait, useInvaliderDonnees } from "@/hooks/useRequetes";
import { transactions, ErreurApi } from "@/api";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { hapticSucces, hapticErreur } from "@/utils/haptics";
import type { Transaction } from "@/api/types";

type ModeRetrait = "partiel" | "tout";
type EtatRetrait = "formulaire" | "attente" | "succes" | "echec" | "timeout";

export default function Retirer() {
  const tdb = useTableauDeBord();
  const verifierCode = useVerifierCodeRetrait();
  const demanderRetrait = useDemanderRetrait();
  const invalider = useInvaliderDonnees();
  const { afficher } = useToast();

  const [mode, setMode] = useState<ModeRetrait>("partiel");
  const [montantSaisi, setMontantSaisi] = useState("");
  const [feuilleVisible, setFeuilleVisible] = useState(false);
  const [erreurCode, setErreurCode] = useState<string | null>(null);
  const [reinitCode, setReinitCode] = useState(0);
  const [transaction, setTransaction] = useState<Transaction | null>(null);
  const [etat, setEtat] = useState<EtatRetrait>("formulaire");
  // Anti-double-envoi : empêche deux POST /retraits simultanés.
  const enCoursRef = useRef(false);

  const retirable = tdb.data?.retirable ?? 0;

  const appliquerPourcentage = (p: number) => {
    setMontantSaisi(String(Math.floor(retirable * p)));
  };

  const lancerRetrait = () => {
    const montant = Number(montantSaisi.replace(/\D/g, "")) || 0;
    if (mode === "partiel" && (montant <= 0 || montant > retirable)) {
      afficher("Montant invalide ou supérieur au montant retirable.", "avertissement");
      return;
    }
    setFeuilleVisible(true);
  };

  // Polling du statut de la transaction de retrait.
  const pollStatut = useCallback(
    async (transactionId: number): Promise<void> => {
      return new Promise((resolve) => {
        const debut = Date.now();
        const intervalle = setInterval(async () => {
          try {
            const t = await transactions.obtenirTransaction(transactionId);
            setTransaction(t);
            if (t.statut === "reussi") {
              clearInterval(intervalle);
              invalider();
              setEtat("succes");
              hapticSucces();
              resolve();
            } else if (t.statut === "echoue") {
              clearInterval(intervalle);
              setEtat("echec");
              hapticErreur();
              resolve();
            } else if (Date.now() - debut > POLLING_TRANSACTION_DUREE_MAX_MS) {
              clearInterval(intervalle);
              setEtat("timeout");
              resolve();
            }
          } catch {
            // Erreurs réseau transitoires ignorées.
          }
        }, POLLING_TRANSACTION_INTERVAL_MS);
      });
    },
    [invalider],
  );

  const surCode = async (code: string) => {
    if (enCoursRef.current) return;
    enCoursRef.current = true;
    setErreurCode(null);
    try {
      const jeton = await verifierCode.mutateAsync(code);
      setFeuilleVisible(false);
      setEtat("attente");

      const params =
        mode === "tout"
          ? { total: true as const, jetonRetrait: jeton }
          : { montant: Number(montantSaisi.replace(/\D/g, "")), jetonRetrait: jeton };

      const res = await demanderRetrait.mutateAsync(params);
      setTransaction(res.transaction);

      // Démo : la transaction est directement réussie.
      if (res.transaction.statut === "reussi") {
        invalider();
        setEtat("succes");
        hapticSucces();
        return;
      }

      // Mode réel : on poll jusqu'à confirmation.
      await pollStatut(res.transaction.id);
    } catch (e) {
      const statut = e instanceof ErreurApi ? e.statut : undefined;
      const msg = e instanceof ErreurApi ? e.message : "Code incorrect ou retrait impossible.";

      // Si le jeton a été consommé côté serveur (401 après envoi) ou si l'opération
      // est en conflit (409), on ferme la feuille et on affiche l'erreur globalement.
      if (statut === 401 || statut === 409 || statut === 422 || statut === 503) {
        setFeuilleVisible(false);
        setEtat("echec");
        afficher(msg, "erreur");
        hapticErreur();
      } else {
        // Erreur locale (code incorrect, timeout réseau) : rester sur la feuille.
        setErreurCode(msg);
        setReinitCode((n) => n + 1);
        hapticErreur();
      }
    } finally {
      enCoursRef.current = false;
    }
  };

  const reinitialiser = () => {
    setEtat("formulaire");
    setTransaction(null);
    setMontantSaisi("");
    setErreurCode(null);
  };

  if (tdb.isPending) {
    return <Ecran><View style={styles.contenu}><CarteSquelette /></View></Ecran>;
  }
  if (tdb.isError) {
    return (
      <Ecran>
        <View style={styles.contenu}>
          <EtatErreur message="Impossible de charger votre solde." onReessayer={() => tdb.refetch()} />
        </View>
      </Ecran>
    );
  }

  if (etat === "attente") {
    return (
      <Ecran defilement={false}>
        <View style={[styles.contenu, styles.centré]}>
          <Icone nom="time-outline" taille={56} couleur={theme.couleurs.primaire} />
          <Text style={[theme.typographie.titre2, { color: theme.couleurs.textePrimaire, textAlign: "center" }]}>
            Retrait en cours…
          </Text>
          <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire, textAlign: "center" }]}>
            Envoi vers {MOYEN_PAIEMENT}. Patientez.
          </Text>
        </View>
      </Ecran>
    );
  }

  if (etat === "succes" && transaction) {
    return (
      <Ecran defilement={false}>
        <View style={[styles.contenu, styles.centré]}>
          <View style={styles.rondeSucces}>
            <Icone nom="checkmark" taille={40} couleur="#FFFFFF" />
          </View>
          <Text style={[theme.typographie.titre2, { color: theme.couleurs.textePrimaire, textAlign: "center" }]}>
            Retrait initié
          </Text>
          <Text style={[theme.typographie.montantGrand, { color: theme.couleurs.primaire }]}>
            {formaterFCFA(transaction.montant)}
          </Text>
          <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire, textAlign: "center" }]}>
            Les fonds seront envoyés sur {MOYEN_PAIEMENT}.
          </Text>
          <Bouton libelle="Fermer" onPress={reinitialiser} style={{ marginTop: 8 }} />
        </View>
      </Ecran>
    );
  }

  if (etat === "timeout") {
    return (
      <Ecran defilement={false}>
        <View style={[styles.contenu, styles.centré]}>
          <Icone nom="hourglass-outline" taille={56} couleur={theme.couleurs.or} />
          <Text style={[theme.typographie.titre2, { color: theme.couleurs.textePrimaire, textAlign: "center" }]}>
            Retrait en attente de confirmation
          </Text>
          <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire, textAlign: "center" }]}>
            Votre retrait est en cours de traitement. Revenez vérifier votre solde dans quelques instants.
          </Text>
          <Bouton libelle="Retour" onPress={reinitialiser} />
        </View>
      </Ecran>
    );
  }

  if (etat === "echec") {
    return (
      <Ecran defilement={false}>
        <View style={[styles.contenu, styles.centré]}>
          <EtatErreur
            message={transaction ? `Le retrait de ${formaterFCFA(transaction.montant)} a échoué.` : "Le retrait a échoué."}
            onReessayer={reinitialiser}
          />
        </View>
      </Ecran>
    );
  }

  return (
    <>
      <Ecran defilement paddingBas={96}>
        <View style={styles.contenu}>

          {/* Carte solde retirable */}
          <Carte style={styles.carteSolde}>
            <Text style={[theme.typographie.corps2, { color: "rgba(255,255,255,0.78)" }]}>Montant retirable</Text>
            <Text style={[theme.typographie.montantGrand, { color: "#FFFFFF" }]}>{formaterFCFA(retirable)}</Text>
          </Carte>

          {/* Choix du mode */}
          <Carte>
            <View style={styles.choixMode}>
              <BoutonMode libelle="Retrait partiel" actif={mode === "partiel"} onPress={() => setMode("partiel")} />
              <BoutonMode libelle="Tout retirer" actif={mode === "tout"} onPress={() => setMode("tout")} />
            </View>

            {mode === "partiel" ? (
              <View style={styles.montantPartiel}>
                <Champ
                  label="Montant à retirer"
                  value={montantSaisi}
                  onChangeText={(t) => setMontantSaisi(t.replace(/\D/g, ""))}
                  clavier="number-pad"
                  placeholder={formaterFCFA(retirable)}
                />
                <View style={styles.puces}>
                  {([0.25, 0.5, 1] as const).map((p) => (
                    <Bouton
                      key={p}
                      libelle={p === 1 ? "Max" : `${p * 100}\u00A0%`}
                      variante="secondaire"
                      plein={false}
                      onPress={() => appliquerPourcentage(p)}
                      style={styles.puce}
                    />
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.avertissement}>
                <Icone nom="warning-outline" taille={20} couleur={theme.couleurs.or} />
                <Text style={[theme.typographie.corps2, { color: theme.couleurs.textePrimaire, flex: 1, minWidth: 0 }]}>
                  Si vous retirez tout, votre compteur repart à 0 et les mises retenues restent à l'application.
                </Text>
              </View>
            )}
          </Carte>

          {/* Moyen de paiement */}
          <Carte>
            <View style={styles.paiementLigne}>
              <Icone nom="phone-portrait-outline" taille={20} couleur={theme.couleurs.primaire} />
              <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.textePrimaire, flex: 1 }]}>
                Retrait vers {MOYEN_PAIEMENT}
              </Text>
            </View>
            <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire, marginTop: 6 }]}>
              {MENTION_FRAIS_FEDAPAY}
            </Text>
          </Carte>

          <Bouton
            libelle={`Retirer vers ${MOYEN_PAIEMENT}`}
            onPress={lancerRetrait}
            chargement={demanderRetrait.isPending || verifierCode.isPending}
            iconeGauche="arrow-up-circle-outline"
          />
        </View>
      </Ecran>

      {/* Feuille basse : saisie du code de retrait */}
      <FeuilleBasse visible={feuilleVisible} onClose={() => setFeuilleVisible(false)}>
        <ClavierCode
          longueur={4}
          titre="Code de retrait"
          sousTitre="Saisissez votre code à 4 chiffres pour confirmer."
          erreur={erreurCode}
          cleReinit={reinitCode}
          onComplet={surCode}
        />
      </FeuilleBasse>
    </>
  );
}

function BoutonMode({ libelle, actif, onPress }: { libelle: string; actif: boolean; onPress: () => void }) {
  return (
    <Bouton
      libelle={libelle}
      variante={actif ? "primaire" : "secondaire"}
      plein={false}
      onPress={onPress}
      style={styles.boutonMode}
    />
  );
}

const styles = StyleSheet.create({
  contenu: {
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 12,
    gap: theme.espacements.interBloc,
    paddingBottom: 12,
  },
  centré: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  carteSolde: {
    backgroundColor: theme.couleurs.primaireFonce,
    gap: 6,
  },
  choixMode: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  boutonMode: {
    flex: 1,
    minWidth: 0,
    minHeight: 48,
  },
  montantPartiel: {
    gap: 12,
  },
  puces: {
    flexDirection: "row",
    gap: 8,
  },
  puce: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
  },
  avertissement: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: theme.couleurs.orClair,
    borderRadius: 14,
    padding: 14,
  },
  paiementLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  rondeSucces: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: theme.couleurs.succes,
    alignItems: "center",
    justifyContent: "center",
  },
});
