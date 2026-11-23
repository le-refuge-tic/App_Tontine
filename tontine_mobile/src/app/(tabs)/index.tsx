import { useState } from "react";
import { router } from "expo-router";
import { Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import { Ecran } from "@/components/Ecran";
import { Carte } from "@/components/Carte";
import { CarteHero } from "@/components/CarteHero";
import { BarreRepartition } from "@/components/BarreRepartition";
import { CarnetDuMois } from "@/components/CarnetDuMois";
import { LigneOperation } from "@/components/LigneOperation";
import { Icone } from "@/components/Icone";
import { EtatVide } from "@/components/EtatVide";
import { EtatErreur } from "@/components/EtatErreur";
import { CarteSquelette, ListeSquelette, Squelette } from "@/components/Squelette";
import { theme } from "@/theme";
import { TOTAL_JOURS_CYCLE } from "@/constants/app";
import { EST_MODE_DEMO } from "@/constants/env";
import { useAuth } from "@/hooks/useAuth";
import { useTableauDeBord, useCycleEnCours, useEcritures, useNotifications } from "@/hooks/useRequetes";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { dateJourBeninISO, maintenantComposants, formaterDateCourte } from "@/utils/dates";
import { hapticSelection } from "@/utils/haptics";

export default function Accueil() {
  const { membre } = useAuth();
  const tdb = useTableauDeBord();
  const cycle = useCycleEnCours();
  const ecritures = useEcritures();
  const notifs = useNotifications();
  const [rafraichit, setRafraichit] = useState(false);

  const nonLues = (notifs.data ?? []).filter((n) => !n.lue).length;
  const aujourdhui = dateJourBeninISO();
  const jourAujourdhui = (cycle.data?.jours ?? []).find((j) => j.datePrevue === aujourdhui);
  const jourCourant = jourAujourdhui?.numeroJour ?? 1;

  const prochaine =
    (cycle.data?.jours ?? []).find((j) => j.statut === "a_payer" && j.datePrevue >= aujourdhui) ??
    (cycle.data?.jours ?? []).find((j) => j.statut === "a_payer");

  const rafraichir = async () => {
    setRafraichit(true);
    await Promise.all([tdb.refetch(), cycle.refetch(), ecritures.refetch(), notifs.refetch()]);
    setRafraichit(false);
  };

  const salutation = (() => {
    const h = maintenantComposants().heure;
    if (h < 12) return "Bonjour";
    if (h < 18) return "Bon après-midi";
    return "Bonsoir";
  })();
  const prenom = (membre?.nom ?? "").split(" ")[0] || "à toi";

  return (
    <Ecran
      defilement
      paddingBas={96}
      style={undefined}
    >
      <RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={theme.couleurs.primaire} />
      <View style={styles.contenu}>
        <EnTete prenom={prenom} salutation={salutation} nonLues={nonLues} />

        <Animated.View entering={FadeIn.duration(280)}>
          {tdb.isPending ? (
            <CarteSquelette />
          ) : tdb.data ? (
            <CarteHero
              soldeCotise={tdb.data.soldeCotisation}
              jourCourant={jourCourant}
              totalJours={TOTAL_JOURS_CYCLE}
              onCotiser={() => router.push("/cotiser")}
              onRetirer={() => router.push("/retirer")}
            />
          ) : (
            <Carte style={styles.carteErreur}>
              <EtatErreur message="Impossible de charger votre solde." onReessayer={() => tdb.refetch()} />
            </Carte>
          )}
        </Animated.View>

        {tdb.data ? (
          <View style={styles.repartition}>
            <BarreRepartition
              retirable={tdb.data.retirable}
              fondsCaisse={tdb.data.fondsCaisseRetenu}
              bloque={tdb.data.soldeBloque}
            />
          </View>
        ) : null}

        {/* Prochaine échéance */}
        <Carte style={styles.echeance}>
          <View style={styles.echeanceLigne}>
            <View style={styles.echeanceGauche}>
              <Icone nom="calendar-outline" taille={20} couleur={theme.couleurs.primaire} />
              <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.texteSecondaire }]}>Prochaine échéance</Text>
            </View>
            <View style={styles.echeanceDroite}>
              <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.textePrimaire }]}>
                {prochaine ? (prochaine.datePrevue === aujourdhui ? "Aujourd'hui" : formaterDateCourte(prochaine.datePrevue)) : "—"}
              </Text>
              <Text style={[theme.typographie.montantPetit, { color: theme.couleurs.textePrimaire }]}>
                {prochaine ? formaterFCFA(prochaine.montantDu) : "—"}
              </Text>
            </View>
          </View>
        </Carte>

        {/* Carnet du mois */}
        <SectionTitre titre="Carnet du mois" />
        {cycle.isPending ? (
          <Carte>
            <Squelette width="100%" height={170} rayon={16} />
          </Carte>
        ) : cycle.data && cycle.data.jours.length > 0 ? (
          <Carte>
            <CarnetDuMois
                jours={cycle.data.jours}
                dateDebut={cycle.data.dateDebut}
                dateFin={cycle.data.dateFin}
              />
          </Carte>
        ) : cycle.data ? (
          <Carte>
            <EtatVide icone="calendar-outline" titre="Pas encore de cycle" message="Votre cycle de cotisation apparaîtra ici dès qu'il sera ouvert." />
          </Carte>
        ) : (
          <Carte>
            <EtatErreur message="Impossible de charger le carnet." onReessayer={() => cycle.refetch()} />
          </Carte>
        )}

        {/* Dernières opérations */}
        <SectionTitre titre="Dernières opérations" actionLabel="Tout voir" onAction={() => router.push("/rapport")} />
        <Carte>
          {ecritures.isPending ? (
            <ListeSquelette nombre={4} />
          ) : ecritures.data && ecritures.data.length > 0 ? (
            (ecritures.data.slice(0, 5).map((e) => <LigneOperation key={e.id} ecriture={e} />))
          ) : ecritures.data ? (
            <EtatVide icone="receipt-outline" titre="Aucune opération" message="Vos cotisations apparaîtront ici." />
          ) : (
            <EtatErreur message="Impossible de charger les opérations." onReessayer={() => ecritures.refetch()} />
          )}
        </Carte>
      </View>
    </Ecran>
  );
}

function EnTete({ prenom, salutation, nonLues }: { prenom: string; salutation: string; nonLues: number }) {
  const ouvrirOutilsTest = () => {
    // Outils de test : uniquement en mode dev + mode réel.
    if (__DEV__ && !EST_MODE_DEMO) {
      hapticSelection();
      router.push("/outils-test" as never);
    }
  };

  return (
    <View style={styles.entete}>
      <Pressable onLongPress={ouvrirOutilsTest} delayLongPress={800} hitSlop={4} style={styles.enteteGauche}>
        <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]} maxFontSizeMultiplier={1.2}>{salutation},</Text>
        <Text style={[theme.typographie.titre3, { color: theme.couleurs.textePrimaire }]} numberOfLines={1} maxFontSizeMultiplier={1.2}>{prenom}</Text>
      </Pressable>
      <View style={styles.enteteDroite}>
        <Pressable onPress={() => router.push("/notifications")} hitSlop={10} style={styles.cloche} accessibilityLabel="Notifications">
          <Icone nom="notifications-outline" taille={24} couleur={theme.couleurs.textePrimaire} />
          {nonLues > 0 ? <View style={styles.pastille}><Text style={styles.pastilleTexte}>{nonLues > 9 ? "9+" : nonLues}</Text></View> : null}
        </Pressable>
        <Pressable onPress={() => { hapticSelection(); router.push("/profil"); }} hitSlop={10} accessibilityLabel="Profil">
          <Avatar nom={prenom} />
        </Pressable>
      </View>
    </View>
  );
}

function Avatar({ nom }: { nom: string }) {
  const initiale = (nom[0] ?? "?").toUpperCase();
  return (
    <View style={styles.avatar}>
      <Text style={[theme.typographie.corpsMedium, { color: theme.couleurs.primaireFonce }]}>{initiale}</Text>
    </View>
  );
}

function SectionTitre({ titre, actionLabel, onAction }: { titre: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionTitre}>
      <Text style={[theme.typographie.titre3, { color: theme.couleurs.textePrimaire }]}>{titre}</Text>
      {actionLabel ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.primaire }]}>{actionLabel}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  contenu: {
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 12,
    gap: theme.espacements.interBloc,
    paddingBottom: 12,
  },
  entete: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  enteteGauche: {
    flex: 1,
    minWidth: 0,
    paddingRight: 8,
  },
  enteteDroite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cloche: {
    position: "relative",
    padding: 4,
  },
  pastille: {
    position: "absolute",
    top: 0,
    right: 0,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: theme.couleurs.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  pastilleTexte: {
    ...theme.typographie.legende2,
    color: "#FFFFFF",
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.couleurs.primaireTresClair,
    alignItems: "center",
    justifyContent: "center",
  },
  carteErreur: {
    padding: 0,
  },
  repartition: {
    marginTop: -4,
  },
  echeance: {},
  echeanceLigne: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  echeanceGauche: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  echeanceDroite: {
    alignItems: "flex-end",
    gap: 2,
    flexShrink: 0,
  },
  sectionTitre: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
  },
});
