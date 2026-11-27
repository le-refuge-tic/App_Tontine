import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router, useLocalSearchParams } from "expo-router";
import { Ecran } from "@/components/Ecran";
import { Carte } from "@/components/Carte";
import { Champ } from "@/components/Champ";
import { Bouton } from "@/components/Bouton";
import { Icone } from "@/components/Icone";
import { BandeauRetour } from "@/components/BandeauRetour";
import { EtatErreur } from "@/components/EtatErreur";
import { useToast } from "@/components/Toast";
import { theme } from "@/theme";
import {
  MOYEN_PAIEMENT,
  MENTION_FRAIS_FEDAPAY,
  POLLING_TRANSACTION_INTERVAL_MS,
  POLLING_TRANSACTION_DUREE_MAX_MS,
} from "@/constants/app";
import {
  LIB_DEPOSER,
  LIB_MONTANT_DEPOT,
  LIB_DEPOT_REUSSI,
} from "@/constants/libelles";
import { useAjouterDepotEpargne } from "@/hooks/useRequetes";
import { transactions, ErreurApi } from "@/api";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { hapticSucces, hapticErreur } from "@/utils/haptics";
import type { Transaction } from "@/api/types";

type EtatFlux =
  | "formulaire"
  | "attente_paiement"
  | "attente_confirmation"
  | "succes"
  | "echec"
  | "timeout";

export default function DeposerProjet() {
  // La route est `/projets/42-deposer` → id = "42"
  const { id } = useLocalSearchParams<{ id: string }>();
  // Le paramètre contient `42-deposer` → on extrait l'entier avant le tiret.
  const idNum = parseInt(String(id), 10);

  const ajouterDepot = useAjouterDepotEpargne();
  const { afficher } = useToast();

  const [montant, setMontant] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});
  const [etat, setEtat] = useState<EtatFlux>("formulaire");
  const [transactionEnCours, setTransactionEnCours] = useState<Transaction | null>(null);
  const [messageEchec, setMessageEchec] = useState("");
  const enCoursRef = useRef(false);

  const pollStatut = useCallback(
    async (transactionId: number): Promise<void> => {
      return new Promise((resolve) => {
        const debut = Date.now();
        const intervalle = setInterval(async () => {
          try {
            const t = await transactions.obtenirTransaction(transactionId);
            setTransactionEnCours(t);
            if (t.statut === "reussi") {
              clearInterval(intervalle);
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
            /* erreurs réseau transitoires ignorées */
          }
        }, POLLING_TRANSACTION_INTERVAL_MS);
      });
    },
    [],
  );

  const soumettre = async () => {
    const montantN = Number(montant);
    if (!Number.isInteger(montantN) || montantN < 1) {
      setErreurs({ montant: "Le montant doit être un entier ≥ 1." });
      return;
    }
    if (isNaN(idNum)) {
      setErreurs({ _serveur: "Identifiant de projet invalide." });
      return;
    }
    setErreurs({});
    if (enCoursRef.current) return;
    enCoursRef.current = true;
    try {
      const res = await ajouterDepot.mutateAsync({ id: idNum, montant: montantN });
      setTransactionEnCours(res.transaction);

      if (res.transaction.statut === "reussi") {
        setEtat("succes");
        hapticSucces();
        return;
      }
      if (res.urlPaiement) {
        setEtat("attente_paiement");
        await WebBrowser.openBrowserAsync(res.urlPaiement);
      }
      setEtat("attente_confirmation");
      await pollStatut(res.transaction.id);
    } catch (e) {
      const msg =
        e instanceof ErreurApi
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setMessageEchec(msg);
      setErreurs({ _serveur: msg });
      hapticErreur();
      afficher(msg, "erreur");
    } finally {
      enCoursRef.current = false;
    }
  };

  if (etat === "attente_paiement" || etat === "attente_confirmation") {
    return (
      <Ecran defilement={false}>
        <View style={styles.centré}>
          <Icone nom="time-outline" taille={56} couleur={theme.couleurs.primaire} />
          <Text
            style={[
              theme.typographie.titre2,
              { color: theme.couleurs.textePrimaire, textAlign: "center" },
            ]}
          >
            {etat === "attente_paiement"
              ? "Validez le paiement sur votre téléphone"
              : "Vérification en cours…"}
          </Text>
          {transactionEnCours ? (
            <Text
              style={[theme.typographie.montantGrand, { color: theme.couleurs.primaire }]}
            >
              {formaterFCFA(transactionEnCours.montant)}
            </Text>
          ) : null}
        </View>
      </Ecran>
    );
  }

  if (etat === "timeout") {
    return (
      <Ecran defilement={false}>
        <View style={styles.centré}>
          <Icone nom="hourglass-outline" taille={56} couleur={theme.couleurs.or} />
          <Text
            style={[
              theme.typographie.titre2,
              { color: theme.couleurs.textePrimaire, textAlign: "center" },
            ]}
          >
            Paiement en attente de confirmation
          </Text>
          <Text
            style={[
              theme.typographie.corps2,
              { color: theme.couleurs.texteSecondaire, textAlign: "center" },
            ]}
          >
            Votre opérateur n'a pas encore confirmé. Revenez vérifier dans la liste.
          </Text>
          <Bouton
            libelle="Retour au projet"
            onPress={() => router.back()}
            iconeGauche="arrow-back-outline"
          />
        </View>
      </Ecran>
    );
  }

  if (etat === "succes" && transactionEnCours) {
    return (
      <Ecran defilement={false}>
        <View style={styles.centré}>
          <View style={styles.rondeSucces}>
            <Icone nom="checkmark" taille={40} couleur="#FFFFFF" />
          </View>
          <Text
            style={[
              theme.typographie.titre2,
              { color: theme.couleurs.textePrimaire, textAlign: "center" },
            ]}
          >
            {LIB_DEPOT_REUSSI}
          </Text>
          <Text
            style={[
              theme.typographie.montantGrand,
              { color: theme.couleurs.primaire, textAlign: "center" },
            ]}
          >
            {formaterFCFA(transactionEnCours.montant)}
          </Text>
          <Bouton
            libelle="Retour au projet"
            onPress={() => router.back()}
            iconeGauche="arrow-back-outline"
            style={{ marginTop: 8 }}
          />
        </View>
      </Ecran>
    );
  }

  if (etat === "echec") {
    return (
      <Ecran>
        <View style={styles.contenu}>
          <BandeauRetour titre={LIB_DEPOSER} />
          <Carte>
            <EtatErreur
              message={messageEchec || "Le paiement a échoué."}
              onReessayer={() => setEtat("formulaire")}
            />
          </Carte>
        </View>
      </Ecran>
    );
  }

  return (
    <Ecran paddingBas={24}>
      <View style={styles.contenu}>
        <BandeauRetour titre={LIB_DEPOSER} />

        <Champ
          label={LIB_MONTANT_DEPOT}
          value={montant}
          onChangeText={setMontant}
          placeholder="Ex. 2000"
          clavier="number-pad"
          erreur={erreurs.montant}
          iconeGauche="cash-outline"
        />

        {erreurs._serveur ? (
          <Carte>
            <EtatErreur
              message={erreurs._serveur}
              onReessayer={() => setErreurs({})}
            />
          </Carte>
        ) : null}

        <Carte style={styles.paiement}>
          <View style={styles.paiementLigne}>
            <Icone nom="phone-portrait-outline" taille={20} couleur={theme.couleurs.primaire} />
            <Text
              style={[
                theme.typographie.corps2Medium,
                { color: theme.couleurs.textePrimaire, flex: 1 },
              ]}
            >
              Moyen de paiement : {MOYEN_PAIEMENT}
            </Text>
          </View>
          <Text
            style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}
          >
            {MENTION_FRAIS_FEDAPAY}
          </Text>
        </Carte>

        <Bouton
          libelle="Déposer avec FedaPay"
          onPress={soumettre}
          chargement={ajouterDepot.isPending}
          iconeGauche="card-outline"
        />
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: {
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 12,
    gap: theme.espacements.interChamp,
    paddingBottom: 24,
  },
  paiement: {
    gap: 8,
    marginTop: 4,
  },
  paiementLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  centré: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    gap: 16,
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
