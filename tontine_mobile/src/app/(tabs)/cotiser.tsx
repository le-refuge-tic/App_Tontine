import { useCallback, useRef, useState } from "react";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import * as WebBrowser from "expo-web-browser";
import type { UseQueryResult } from "@tanstack/react-query";
import { Ecran } from "@/components/Ecran";
import { Carte } from "@/components/Carte";
import { CarnetDuMois } from "@/components/CarnetDuMois";
import { Bouton } from "@/components/Bouton";
import { Icone } from "@/components/Icone";
import { EtatErreur } from "@/components/EtatErreur";
import { EtatVide } from "@/components/EtatVide";
import { Squelette } from "@/components/Squelette";
import { useToast } from "@/components/Toast";
import { theme } from "@/theme";
import {
  MOYEN_PAIEMENT,
  MENTION_FRAIS_FEDAPAY,
  POLLING_TRANSACTION_INTERVAL_MS,
  POLLING_TRANSACTION_DUREE_MAX_MS,
} from "@/constants/app";
import {
  LIB_JOURS_A_RATTRAPER,
  LIB_AUCUN_JOUR_A_RATTRAPER,
  LIB_JOURS_SELECTIONNES,
  LIB_TOTAL_RATTRAPAGE,
  LIB_PERDU_RATTRAPABLE,
  LIB_RATTRAPER_SELECTION,
} from "@/constants/libelles";
import {
  useCycleEnCours,
  useJoursRattrapables,
  useLancerDepot,
  useInvaliderDonnees,
} from "@/hooks/useRequetes";
import { transactions, ErreurApi } from "@/api";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { dateJourBeninISO, formaterDateCourte } from "@/utils/dates";
import { hapticSucces, hapticErreur } from "@/utils/haptics";
import type { JourRattrapable, Transaction } from "@/api/types";

type EtatPaiement =
  | "selection"
  | "attente_paiement"
  | "attente_confirmation"
  | "succes"
  | "echec"
  | "timeout";

export default function Cotiser() {
  const cycle = useCycleEnCours();
  const joursRattrapablesQuery = useJoursRattrapables();
  const lancerDepot = useLancerDepot();
  const invalider = useInvaliderDonnees();
  const { afficher } = useToast();

  const [joursSelectionnes, setJoursSelectionnes] = useState<number[]>([]);
  const [etatPaiement, setEtatPaiement] = useState<EtatPaiement>("selection");
  const [transactionEnCours, setTransactionEnCours] = useState<Transaction | null>(null);
  const [messageEchec, setMessageEchec] = useState<string>("");
  const [rafraichit, setRafraichit] = useState(false);
  // Anti-double-clic : empêche deux POST /depots simultanés.
  const enCoursRef = useRef(false);

  const aujourdhui = dateJourBeninISO();
  const jours = cycle.data?.jours ?? [];
  const jourDuJour = jours.find((j) => j.datePrevue === aujourdhui);
  const montantJour = jourDuJour?.montantDu ?? cycle.data?.miseBase ?? 0;

  // Total indicatif des jours sélectionnés (affichage uniquement,
  // le vrai total vient du serveur au moment du POST /depots).
  const totalSelectionne = [
    ...jours.filter((j) => joursSelectionnes.includes(j.id)),
    ...(joursRattrapablesQuery.data ?? []).filter((j) =>
      joursSelectionnes.includes(j.id),
    ),
  ].reduce((s, j) => s + j.montantDu, 0);

  const toggleJour = (id: number) =>
    setJoursSelectionnes((prev) =>
      prev.includes(id) ? prev.filter((j) => j !== id) : [...prev, id],
    );

  // Polling du statut de la transaction.
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
              invalider();
              setEtatPaiement("succes");
              hapticSucces();
              resolve();
            } else if (t.statut === "echoue") {
              clearInterval(intervalle);
              setEtatPaiement("echec");
              hapticErreur();
              resolve();
            } else if (Date.now() - debut > POLLING_TRANSACTION_DUREE_MAX_MS) {
              clearInterval(intervalle);
              setEtatPaiement("timeout");
              resolve();
            }
          } catch {
            // Erreurs réseau transitoires ignorées pendant le polling.
          }
        }, POLLING_TRANSACTION_INTERVAL_MS);
      });
    },
    [invalider],
  );

  const payer = async () => {
    if (enCoursRef.current) return;
    enCoursRef.current = true;
    try {
      // Sans sélection manuelle : tableau vide → le backend choisit le jour
      // a_payer d'aujourd'hui. Avec sélection : rattrapage des jours fournis.
      const idsAPayer = joursSelectionnes.length > 0 ? joursSelectionnes : [];

      const res = await lancerDepot.mutateAsync(idsAPayer);
      setTransactionEnCours(res.transaction);

      // Si la transaction est déjà réussie (démo ou anti-double-clic).
      if (res.transaction.statut === "reussi") {
        setEtatPaiement("succes");
        hapticSucces();
        return;
      }

      // Ouvrir le navigateur pour le paiement FedaPay.
      if (res.urlPaiement) {
        setEtatPaiement("attente_paiement");
        await WebBrowser.openBrowserAsync(res.urlPaiement);
      }

      // Une fois le navigateur fermé (ou si pas d'URL), passer en polling.
      setEtatPaiement("attente_confirmation");
      await pollStatut(res.transaction.id);
    } catch (e) {
      const msg =
        e instanceof ErreurApi
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      console.error("[COTISER] Erreur payer():", msg, e);
      setMessageEchec(msg);
      setEtatPaiement("echec");
      afficher(msg, "erreur");
      hapticErreur();
    } finally {
      enCoursRef.current = false;
    }
  };

  const verifierANouveau = async () => {
    if (!transactionEnCours) return;
    setEtatPaiement("attente_confirmation");
    await pollStatut(transactionEnCours.id);
  };

  const rafraichir = async () => {
    setRafraichit(true);
    await Promise.all([cycle.refetch(), joursRattrapablesQuery.refetch()]);
    setRafraichit(false);
    setJoursSelectionnes([]);
    setEtatPaiement("selection");
  };

  if (etatPaiement === "attente_paiement" || etatPaiement === "attente_confirmation") {
    return (
      <EcranAttente
        enAttentePaiement={etatPaiement === "attente_paiement"}
        transaction={transactionEnCours}
      />
    );
  }

  if (etatPaiement === "timeout") {
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
            Votre opérateur n'a pas encore confirmé le paiement. Réessayez dans quelques instants.
          </Text>
          <Bouton
            libelle="Vérifier à nouveau"
            onPress={verifierANouveau}
            iconeGauche="refresh-outline"
            style={{ marginTop: 8 }}
          />
          <Bouton
            libelle="Retour"
            variante="secondaire"
            onPress={() => {
              setEtatPaiement("selection");
              setJoursSelectionnes([]);
            }}
          />
        </View>
      </Ecran>
    );
  }

  if (etatPaiement === "succes" && transactionEnCours) {
    return (
      <EcranSucces
        transaction={transactionEnCours}
        onTerminer={() => {
          setEtatPaiement("selection");
          setJoursSelectionnes([]);
        }}
      />
    );
  }

  if (etatPaiement === "echec") {
    return (
      <Ecran>
        <View style={styles.contenu}>
          <Carte style={styles.echecCarte}>
            <EtatErreur
              message={messageEchec || "Le paiement a échoué ou n'a pas été validé."}
              onReessayer={() => setEtatPaiement("selection")}
            />
          </Carte>
        </View>
      </Ecran>
    );
  }

  return (
    <Ecran defilement paddingBas={96}>
      <RefreshControl
        refreshing={rafraichit}
        onRefresh={rafraichir}
        tintColor={theme.couleurs.primaire}
      />
      <View style={styles.contenu}>
        {/* Montant du jour */}
        <Carte style={styles.carteMontant}>
          <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}>
            Montant du jour
          </Text>
          <Text style={[theme.typographie.montantGrand, { color: theme.couleurs.textePrimaire }]}>
            {formaterFCFA(montantJour)}
          </Text>
        </Carte>

        {/* Carnet en mode sélection */}
        {cycle.isPending ? (
          <Carte>
            <Squelette width="100%" height={170} rayon={16} />
          </Carte>
        ) : cycle.isError ? (
          <Carte>
            <EtatErreur
              message="Impossible de charger le carnet."
              onReessayer={() => cycle.refetch()}
            />
          </Carte>
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

        {/* Section jours à rattraper (cycles précédents) */}
        <SectionJoursRattrapables
          query={joursRattrapablesQuery}
          joursSelectionnes={joursSelectionnes}
          onToggleJour={toggleJour}
        />

        {/* Récapitulatif des jours sélectionnés */}
        {joursSelectionnes.length > 0 ? (
          <Carte style={styles.recap}>
            <View style={styles.recapLigne}>
              <Text style={[theme.typographie.corps2Medium, styles.recapLibelle]}>
                {LIB_JOURS_SELECTIONNES}
              </Text>
              <Text style={[theme.typographie.corps2Medium, styles.recapValeur]}>
                {joursSelectionnes.length}
              </Text>
            </View>
            <View style={styles.recapLigne}>
              <Text style={[theme.typographie.corpsMedium, styles.recapLibelle]}>
                {LIB_TOTAL_RATTRAPAGE}
              </Text>
              <Text style={[theme.typographie.montantPetit, styles.recapValeur]}>
                {formaterFCFA(totalSelectionne)}
              </Text>
            </View>
          </Carte>
        ) : null}

        {/* Moyen de paiement */}
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
            style={[
              theme.typographie.corps2,
              styles.frais,
              { color: theme.couleurs.texteSecondaire },
            ]}
          >
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

// ── Sous-composants ────────────────────────────────────────────────────────

function EcranAttente({
  enAttentePaiement,
  transaction,
}: {
  enAttentePaiement: boolean;
  transaction: Transaction | null;
}) {
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
          {enAttentePaiement
            ? "Validez le paiement sur votre téléphone"
            : "Vérification en cours…"}
        </Text>
        {transaction ? (
          <Text style={[theme.typographie.montantGrand, { color: theme.couleurs.primaire }]}>
            {formaterFCFA(transaction.montant)}
          </Text>
        ) : null}
        <Text
          style={[
            theme.typographie.corps2,
            { color: theme.couleurs.texteSecondaire, textAlign: "center" },
          ]}
        >
          {enAttentePaiement
            ? "Revenez dans l'app après avoir confirmé le paiement."
            : "Nous attendons la confirmation de votre opérateur…"}
        </Text>
      </View>
    </Ecran>
  );
}

function EcranSucces({
  transaction,
  onTerminer,
}: {
  transaction: Transaction;
  onTerminer: () => void;
}) {
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
          Paiement réussi
        </Text>
        <Text
          style={[
            theme.typographie.montantGrand,
            { color: theme.couleurs.primaire, textAlign: "center" },
          ]}
        >
          {formaterFCFA(transaction.montant)}
        </Text>
        <Bouton libelle="Fermer" onPress={onTerminer} style={{ marginTop: 24 }} />
      </View>
    </Ecran>
  );
}

function SectionJoursRattrapables({
  query,
  joursSelectionnes,
  onToggleJour,
}: {
  query: UseQueryResult<JourRattrapable[]>;
  joursSelectionnes: number[];
  onToggleJour: (id: number) => void;
}) {
  if (query.isPending) {
    return (
      <Carte>
        <Squelette width="100%" height={80} rayon={12} />
      </Carte>
    );
  }
  if (query.isError) {
    return (
      <Carte>
        <EtatErreur
          message="Impossible de charger les jours à rattraper."
          onReessayer={() => query.refetch()}
        />
      </Carte>
    );
  }

  const jours = query.data ?? [];

  return (
    <Animated.View entering={FadeIn.duration(300)}>
      <Carte style={styles.sectionRattrapage}>
        <View style={styles.sectionRattrapeEntete}>
          <Icone nom="refresh-circle-outline" taille={20} couleur={theme.couleurs.or} />
          <Text style={[theme.typographie.titre3, { color: theme.couleurs.textePrimaire }]}>
            {LIB_JOURS_A_RATTRAPER}
          </Text>
        </View>

        {jours.length === 0 ? (
          <EtatVide
            icone="checkmark-circle-outline"
            titre={LIB_AUCUN_JOUR_A_RATTRAPER}
            message="Vous êtes à jour dans vos cotisations."
          />
        ) : (
          <>
            <Text
              style={[
                theme.typographie.corps2,
                styles.rattrapeConsigne,
                { color: theme.couleurs.texteSecondaire },
              ]}
            >
              {LIB_RATTRAPER_SELECTION}
            </Text>
            {jours.map((j) => {
              const selectionne = joursSelectionnes.includes(j.id);
              return (
                <Pressable
                  key={j.id}
                  onPress={() => onToggleJour(j.id)}
                  style={[
                    styles.ligneJourRattrape,
                    selectionne && styles.ligneJourSelectionne,
                  ]}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: selectionne }}
                >
                  <View style={[styles.checkboxRond, selectionne && styles.checkboxRondActif]}>
                    {selectionne ? (
                      <Icone nom="checkmark" taille={14} couleur="#FFFFFF" />
                    ) : null}
                  </View>
                  <View style={styles.ligneJourTexte}>
                    <Text
                      style={[
                        theme.typographie.corps2Medium,
                        { color: theme.couleurs.textePrimaire },
                      ]}
                    >
                      Jour {j.numeroJour} — {formaterDateCourte(j.datePrevue)}
                    </Text>
                    <Text style={[theme.typographie.legende, { color: theme.couleurs.grisPerdu }]}>
                      {LIB_PERDU_RATTRAPABLE}
                    </Text>
                  </View>
                  <Text
                    style={[
                      theme.typographie.montantPetit,
                      { color: theme.couleurs.textePrimaire, flexShrink: 0 },
                    ]}
                  >
                    {formaterFCFA(j.montantDu)}
                  </Text>
                </Pressable>
              );
            })}
          </>
        )}
      </Carte>
    </Animated.View>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────

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
  // ── Section jours à rattraper
  sectionRattrapage: {
    gap: 12,
  },
  sectionRattrapeEntete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  rattrapeConsigne: {
    marginBottom: 2,
  },
  ligneJourRattrape: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.couleurs.bordure,
  },
  ligneJourSelectionne: {
    backgroundColor: theme.couleurs.primaireTresClair,
    borderColor: theme.couleurs.primaire,
  },
  checkboxRond: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: theme.couleurs.grisPerdu,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  checkboxRondActif: {
    backgroundColor: theme.couleurs.primaire,
    borderColor: theme.couleurs.primaire,
  },
  ligneJourTexte: {
    flex: 1,
    flexShrink: 1,
    gap: 2,
  },
});
