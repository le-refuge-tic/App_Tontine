import { useCallback, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import * as WebBrowser from "expo-web-browser";
import { router } from "expo-router";
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
  LIB_NOUVEAU_PROJET,
  LIB_NOM_PROJET,
  LIB_OBJECTIF,
  LIB_OBJECTIF_AIDE,
  LIB_MONTANT_INITIAL,
  LIB_PROJET_CREE,
  LIB_PROJET_CREE_ZERO,
  LIB_DEPOSER,
} from "@/constants/libelles";
import { useCreerEpargne } from "@/hooks/useRequetes";
import { transactions, ErreurApi } from "@/api";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { hapticSucces, hapticErreur } from "@/utils/haptics";
import type { EpargneVue, Transaction } from "@/api/types";

type EtatFlux =
  | "formulaire"
  | "attente_paiement"
  | "attente_confirmation"
  | "succes"
  | "succes_zero"
  | "echec"
  | "timeout";

function valider(
  nom: string,
  montant: string,
  objectif: string,
): Record<string, string> {
  const errs: Record<string, string> = {};
  if (nom.trim().length < 2 || nom.trim().length > 100) {
    errs.nom = "Le nom doit comporter entre 2 et 100 caractères.";
  }
  const montantN = Number(montant);
  if (!Number.isInteger(montantN) || montantN < 1) {
    errs.montant = "Le montant doit être un entier ≥ 1.";
  }
  // Objectif obligatoire.
  if (objectif.trim() === "") {
    errs.objectif = "L'objectif est obligatoire.";
  } else {
    const objectifN = Number(objectif);
    if (!Number.isInteger(objectifN) || objectifN < 1) {
      errs.objectif = "L'objectif doit être un entier ≥ 1.";
    }
  }
  return errs;
}

export default function NouveauProjet() {
  const creerEpargne = useCreerEpargne();
  const { afficher } = useToast();

  const [nom, setNom] = useState("");
  const [montant, setMontant] = useState("");
  const [objectif, setObjectif] = useState("");
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  const [etat, setEtat] = useState<EtatFlux>("formulaire");
  const [transactionEnCours, setTransactionEnCours] = useState<Transaction | null>(null);
  const [epargneCreee, setEpargneCreee] = useState<EpargneVue | null>(null);

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
    const errs = valider(nom, montant, objectif);
    if (Object.keys(errs).length > 0) {
      setErreurs(errs);
      return;
    }
    setErreurs({});
    if (enCoursRef.current) return;
    enCoursRef.current = true;
    try {
      const res = await creerEpargne.mutateAsync({
        nom: nom.trim(),
        montantInitial: Number(montant),
        objectifMontant: Number(objectif),
      });
      setEpargneCreee(res.epargne);
      setTransactionEnCours(res.transaction);

      // Si le paiement FedaPay a échoué côté serveur, le projet existe à 0.
      if (res.transaction.statut === "echoue") {
        setEtat("succes_zero");
        return;
      }

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
      setErreurs({ _serveur: msg });
      hapticErreur();
      afficher(msg, "erreur");
    } finally {
      enCoursRef.current = false;
    }
  };

  // ── Écrans de flux ─────────────────────────────────────────────────────

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
            Votre opérateur n'a pas encore confirmé. Vérifiez plus tard dans votre liste de projets.
          </Text>
          <Bouton
            libelle="Voir mes projets"
            onPress={() => router.replace("/(tabs)/projets")}
            iconeGauche="wallet-outline"
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
            {LIB_PROJET_CREE}
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
            libelle="Voir le projet"
            onPress={() => {
              if (epargneCreee) {
                router.replace(`/projets/${epargneCreee.id}`);
              } else {
                router.replace("/(tabs)/projets");
              }
            }}
            iconeGauche="arrow-forward-outline"
            style={{ marginTop: 8 }}
          />
        </View>
      </Ecran>
    );
  }

  // Projet créé mais paiement échoué (projet à 0 FCFA).
  if (etat === "succes_zero" && epargneCreee) {
    return (
      <Ecran defilement={false}>
        <View style={styles.centré}>
          <Icone
            nom="alert-circle-outline"
            taille={56}
            couleur={theme.couleurs.avertissement}
          />
          <Text
            style={[
              theme.typographie.titre2,
              { color: theme.couleurs.textePrimaire, textAlign: "center" },
            ]}
          >
            {LIB_PROJET_CREE}
          </Text>
          <Text
            style={[
              theme.typographie.corps2,
              { color: theme.couleurs.texteSecondaire, textAlign: "center" },
            ]}
          >
            {LIB_PROJET_CREE_ZERO}
          </Text>
          <Bouton
            libelle={LIB_DEPOSER}
            onPress={() => router.replace(`/projets/${epargneCreee.id}-deposer`)}
            iconeGauche="add-circle-outline"
          />
          <Bouton
            libelle="Voir mes projets"
            variante="secondaire"
            onPress={() => router.replace("/(tabs)/projets")}
          />
        </View>
      </Ecran>
    );
  }

  // ── Formulaire ─────────────────────────────────────────────────────────

  return (
    <Ecran paddingBas={24}>
      <View style={styles.contenu}>
        <BandeauRetour titre={LIB_NOUVEAU_PROJET} />

        <Champ
          label={LIB_NOM_PROJET}
          value={nom}
          onChangeText={setNom}
          placeholder="Ex. Achat moto"
          autoCapitalize="sentences"
          maxLength={100}
          erreur={erreurs.nom}
          iconeGauche="pencil-outline"
        />

        <Champ
          label={LIB_OBJECTIF}
          value={objectif}
          onChangeText={setObjectif}
          placeholder="Ex. 100000"
          clavier="number-pad"
          erreur={erreurs.objectif}
          iconeGauche="flag-outline"
        />
        <Text
          style={[
            theme.typographie.corps2,
            styles.aideObjectif,
          ]}
        >
          {LIB_OBJECTIF_AIDE}
        </Text>

        <Champ
          label={LIB_MONTANT_INITIAL}
          value={montant}
          onChangeText={setMontant}
          placeholder="Ex. 5000"
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

        {/* Moyen de paiement */}
        <Carte style={styles.paiement}>
          <View style={styles.paiementLigne}>
            <Icone
              nom="phone-portrait-outline"
              taille={20}
              couleur={theme.couleurs.primaire}
            />
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
            style={[
              theme.typographie.corps2,
              { color: theme.couleurs.texteSecondaire },
            ]}
          >
            {MENTION_FRAIS_FEDAPAY}
          </Text>
        </Carte>

        <Bouton
          libelle="Créer et payer"
          onPress={soumettre}
          chargement={creerEpargne.isPending}
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
  aideObjectif: {
    color: theme.couleurs.texteSecondaire,
    marginTop: -8,
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
