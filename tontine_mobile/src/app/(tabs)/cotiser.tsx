import { useCallback, useEffect, useState } from "react";
import { RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ecran } from "@/components/Ecran";
import { Carte } from "@/components/Carte";
import { CarnetDuMois } from "@/components/CarnetDuMois";
import { Bouton } from "@/components/Bouton";
import { Icone } from "@/components/Icone";
import { EtatErreur } from "@/components/EtatErreur";
import { Squelette } from "@/components/Squelette";
import { useToast } from "@/components/Toast";
import { theme } from "@/theme";
import { MOYEN_PAIEMENT, MENTION_FRAIS_FEDAPAY, POLLING_TRANSACTION_INTERVAL_MS, POLLING_TRANSACTION_DUREE_MAX_MS } from "@/constants/app";
import { useCycleEnCours, useLancerDepot } from "@/hooks/useRequetes";
import { transactions, ErreurApi } from "@/api";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { dateJourBeninISO } from "@/utils/dates";
import { hapticSucces, hapticErreur } from "@/utils/haptics";
import type { Transaction } from "@/api/types";

type EtatPaiement = "selection" | "attente" | "succes" | "echec";

export default function Cotiser() {
  const cycle = useCycleEnCours();
  const lancerDepot = useLancerDepot();
  const { afficher } = useToast();

  const [joursSelectionnes, setJoursSelectionnes] = useState<number[]>([]);
  const [etatPaiement, setEtatPaiement] = useState<EtatPaiement>("selection");
  const [transactionEnCours, setTransactionEnCours] = useState<Transaction | null>(null);
  const [rafraichit, setRafraichit] = useState(false);

  const aujourdhui = dateJourBeninISO();
  const jours = cycle.data?.jours ?? [];
  const jourDuJour = jours.find((j) => j.datePrevue === aujourdhui);
  const montantJour = jourDuJour?.montantDu ?? cycle.data?.miseBase ?? 0;

  // Calcul indicatif du total des jours sélectionnés (affichage seulement, pas d'envoi).
  const totalSelectionne = jours
    .filter((j) => joursSelectionnes.includes(j.id))
    .reduce((s, j) => s + j.montantDu, 0);

  const toggleJour = (id: number) =>
    setJoursSelectionnes((prev) =>
      prev.includes(id) ? prev.filter((j) => j !== id) : [...prev, id],
    );

  // Polling de la transaction.
  const pollStatut = useCallback(
    async (transactionId: number) => {
      const debut = Date.now();
      const intervalle = setInterval(async () => {
        try {
          const t = await transactions.obtenirTransaction(transactionId);
          setTransactionEnCours(t);
          if (t.statut === "reussi") {
            clearInterval(intervalle);
            setEtatPaiement("succes");
            hapticSucces();
          } else if (t.statut === "echoue") {
            clearInterval(intervalle);
            setEtatPaiement("echec");
            hapticErreur();
          } else if (Date.now() - debut > POLLING_TRANSACTION_DUREE_MAX_MS) {
            clearInterval(intervalle);
            setEtatPaiement("echec");
          }
        } catch {
          // On ignore les erreurs réseau transitoires pendant le polling.
        }
      }, POLLING_TRANSACTION_INTERVAL_MS);
      return () => clearInterval(intervalle);
    },
    [],
  );

  const payer = async () => {
    setEtatPaiement("attente");
    try {
      const idsAPayer = joursSelectionnes.length > 0 ? joursSelectionnes : (jourDuJour ? [jourDuJour.id] : []);
      const res = await lancerDepot.mutateAsync(idsAPayer);
      setTransactionEnCours(res.transaction);
      if (res.transaction.statut === "reussi") {
        setEtatPaiement("succes");
        hapticSucces();
      } else {
        await pollStatut(res.transaction.id);
      }
    } catch (e) {
      const msg = e instanceof ErreurApi ? e.message : "Paiement impossible pour l'instant.";
      setEtatPaiement("echec");
      afficher(msg, "erreur");
    }
  };

  const rafraichir = async () => {
    setRafraichit(true);
    await cycle.refetch();
    setRafraichit(false);
    setJoursSelectionnes([]);
    setEtatPaiement("selection");
  };

  if (etatPaiement === "attente") return <EcranAttente />;
  if (etatPaiement === "succes" && transactionEnCours) {
    return <EcranSucces transaction={transactionEnCours} onTerminer={() => { setEtatPaiement("selection"); setJoursSelectionnes([]); }} />;
  }
  if (etatPaiement === "echec") {
    return (
      <Ecran>
        <View style={styles.contenu}>
          <Carte style={styles.echecCarte}>
            <EtatErreur message="Le paiement a échoué ou n'a pas été validé à temps." onReessayer={() => setEtatPaiement("selection")} />
          </Carte>
        </View>
      </Ecran>
    );
  }

  return (
    <Ecran defilement paddingBas={96}>
      <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={theme.couleurs.primaire} />
      <View style={styles.contenu}>

        {/* Montant du jour */}
        <Carte style={styles.carteMontant}>
          <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}>Montant du jour</Text>
          <Text style={[theme.typographie.montantGrand, { color: theme.couleurs.textePrimaire }]}>
            {formaterFCFA(montantJour)}
          </Text>
        </Carte>

        {/* Carnet en mode sélection */}
        {cycle.isPending ? (
          <Carte><Squelette width="100%" height={170} rayon={16} /></Carte>
        ) : cycle.isError ? (
          <Carte><EtatErreur message="Impossible de charger le carnet." onReessayer={() => cycle.refetch()} /></Carte>
        ) : cycle.data && cycle.data.jours.length > 0 ? (
          <Animated.View entering={FadeIn.duration(300)}>
            <Carte>
              <Text style={[theme.typographie.corps2Medium, styles.labelCarnet]}>
                Touchez un jour perdu pour le rattraper
              </Text>
              <CarnetDuMois
                jours={cycle.data.jours}
                dateDebut={cycle.data.dateDebut}
                dateFin={cycle.data.dateFin}
                modeSelection
                joursSelectionnes={joursSelectionnes}
                onToggleJour={toggleJour}
              />
            </Carte>
          </Animated.View>
        ) : null}

        {/* Récapitulatif */}
        {joursSelectionnes.length > 0 ? (
          <Carte style={styles.recap}>
            <View style={styles.recapLigne}>
              <Text style={[theme.typographie.corps2Medium, styles.recapLibelle]}>Jours sélectionnés</Text>
              <Text style={[theme.typographie.corps2Medium, styles.recapValeur]}>{joursSelectionnes.length}</Text>
            </View>
            <View style={styles.recapLigne}>
              <Text style={[theme.typographie.corpsMedium, styles.recapLibelle]}>Total indicatif</Text>
              <Text style={[theme.typographie.montantPetit, styles.recapValeur]}>{formaterFCFA(totalSelectionne)}</Text>
            </View>
          </Carte>
        ) : null}

        {/* Moyen de paiement */}
        <Carte style={styles.paiement}>
          <View style={styles.paiementLigne}>
            <Icone nom="phone-portrait-outline" taille={20} couleur={theme.couleurs.primaire} />
            <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.textePrimaire, flex: 1 }]}>
              Moyen de paiement : {MOYEN_PAIEMENT}
            </Text>
          </View>
          <Text style={[theme.typographie.corps2, styles.frais, { color: theme.couleurs.texteSecondaire }]}>
            {MENTION_FRAIS_FEDAPAY}
          </Text>
        </Carte>

        <Bouton
          libelle="Payer avec FedaPay"
          onPress={payer}
          chargement={lancerDepot.isPending}
          iconeGauche="card-outline"
        />
      </View>
    </Ecran>
  );
}

function EcranAttente() {
  return (
    <Ecran defilement={false}>
      <View style={styles.centré}>
        <Icone nom="time-outline" taille={56} couleur={theme.couleurs.primaire} />
        <Text style={[theme.typographie.titre2, { color: theme.couleurs.textePrimaire, textAlign: "center" }]}>
          Validez le paiement sur votre téléphone
        </Text>
        <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire, textAlign: "center" }]}>
          Nous attendons la confirmation de votre opérateur…
        </Text>
      </View>
    </Ecran>
  );
}

function EcranSucces({ transaction, onTerminer }: { transaction: Transaction; onTerminer: () => void }) {
  return (
    <Ecran defilement={false}>
      <View style={styles.centré}>
        <View style={styles.rondeSucces}>
          <Icone nom="checkmark" taille={40} couleur="#FFFFFF" />
        </View>
        <Text style={[theme.typographie.titre2, { color: theme.couleurs.textePrimaire, textAlign: "center" }]}>
          Paiement réussi
        </Text>
        <Text style={[theme.typographie.montantGrand, { color: theme.couleurs.primaire, textAlign: "center" }]}>
          {formaterFCFA(transaction.montant)}
        </Text>
        <Bouton libelle="Fermer" onPress={onTerminer} style={{ marginTop: 24 }} />
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: {
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 12,
    gap: theme.espacements.interBloc,
    paddingBottom: 12,
  },
  carteMontant: {
    gap: 6,
  },
  labelCarnet: {
    color: theme.couleurs.texteSecondaire,
    marginBottom: 14,
  },
  recap: {
    gap: 8,
  },
  recapLigne: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  recapLibelle: {
    color: theme.couleurs.texteSecondaire,
    flex: 1,
    flexShrink: 1,
  },
  recapValeur: {
    color: theme.couleurs.textePrimaire,
    flexShrink: 0,
  },
  paiement: {
    gap: 8,
  },
  paiementLigne: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  frais: {},
  echecCarte: {
    marginTop: 16,
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
