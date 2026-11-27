import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { BandeauRetour } from "@/components/BandeauRetour";
import { Carte } from "@/components/Carte";
import { Bouton } from "@/components/Bouton";
import { Icone } from "@/components/Icone";
import { EtatErreur } from "@/components/EtatErreur";
import { BarreProgression } from "@/components/BarreProgression";
import { CarteSquelette } from "@/components/Squelette";
import { theme } from "@/theme";
import { useEpargne } from "@/hooks/useRequetes";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { formaterTaux } from "@/utils/formaterTaux";
import {
  LIB_STATUT_ACTIF,
  LIB_STATUT_RETIRE,
  LIB_STATUT_CLOTURE,
  LIB_OBJECTIF_COURT,
  LIB_MONTANT_EPARGNE,
  LIB_APERCU_TITRE,
  LIB_APERCU_MENTION,
  LIB_APERCU_RETRAIT_ATTEINT,
  LIB_APERCU_RETRAIT_NON_ATTEINT,
  LIB_PENALITE,
  LIB_TAUX,
  LIB_NET_ESTIME,
  LIB_DEPOSER,
  LIB_RETIRER_PROJET,
  LIB_RETIRER_BIENTOT,
  LIB_MODIFIER_PROJET,
  LIB_RESTE_A_ATTEINDRE,
  LIB_OBJECTIF_ATTEINT_BADGE,
  LIB_FRAIS_RETRAIT,
} from "@/constants/libelles";
import type { EpargneVue } from "@/api/types";

export default function DetailProjet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const idNum = Number(id);
  const epargneQ = useEpargne(isNaN(idNum) ? null : idNum);
  const [rafraichit, setRafraichit] = useState(false);

  const rafraichir = async () => {
    setRafraichit(true);
    await epargneQ.refetch();
    setRafraichit(false);
  };

  if (epargneQ.isPending) {
    return (
      <SafeAreaView style={styles.racine} edges={["top"]}>
        <View style={styles.entete}>
          <BandeauRetour />
        </View>
        <View style={styles.contenu}>
          <CarteSquelette />
          <CarteSquelette />
        </View>
      </SafeAreaView>
    );
  }

  if (epargneQ.isError || !epargneQ.data) {
    return (
      <SafeAreaView style={styles.racine} edges={["top"]}>
        <View style={styles.entete}>
          <BandeauRetour />
        </View>
        <View style={styles.contenu}>
          <EtatErreur
            message="Impossible de charger ce projet."
            onReessayer={() => epargneQ.refetch()}
          />
        </View>
      </SafeAreaView>
    );
  }

  const e = epargneQ.data;
  const estActif = e.statut === "active";
  const statut = libelleStatut(e.statut);
  const couleurStatut = estActif ? theme.couleurs.succes : theme.couleurs.texteSecondaire;
  const objectifAtteint = e.apercu.objectifAtteint;
  const tauxTexte = formaterTaux(e.apercu.tauxApplicable);

  return (
    <SafeAreaView style={styles.racine} edges={["top"]}>
      <View style={styles.entete}>
        <BandeauRetour titre={e.nom} />
      </View>

      <ScrollView
        contentContainerStyle={styles.liste}
        refreshControl={
          <RefreshControl
            refreshing={rafraichit}
            onRefresh={rafraichir}
            tintColor={theme.couleurs.primaire}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Carte principale */}
        <Carte style={styles.cartePrincipale}>
          <View style={styles.rangeeStatut}>
            <View style={[styles.pastilleStatut, { backgroundColor: couleurStatut + "22" }]}>
              <Text style={[theme.typographie.legende, { color: couleurStatut }]}>
                {statut}
              </Text>
            </View>
            {objectifAtteint ? (
              <View style={[styles.pastilleStatut, { backgroundColor: theme.couleurs.or + "33" }]}>
                <Text style={[theme.typographie.legende, { color: theme.couleurs.or }]}>
                  {LIB_OBJECTIF_ATTEINT_BADGE}
                </Text>
              </View>
            ) : null}
          </View>

          <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}>
            {LIB_MONTANT_EPARGNE}
          </Text>
          <Text style={[theme.typographie.montantGrand, { color: theme.couleurs.textePrimaire }]}>
            {formaterFCFA(e.montant)}
          </Text>

          {/* Objectif, barre de progression, reste à atteindre */}
          <View style={styles.objectifBloc}>
            <View style={styles.objectifLigne}>
              <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}>
                {LIB_OBJECTIF_COURT} : {formaterFCFA(e.objectifMontant)}
              </Text>
              <Text
                style={[
                  theme.typographie.corps2Medium,
                  { color: theme.couleurs.primaire },
                ]}
              >
                {e.progressionPourcent} %
              </Text>
            </View>
            <BarreProgression
              valeur={e.progressionPourcent / 100}
              couleurRemplissage={objectifAtteint ? theme.couleurs.or : theme.couleurs.primaire}
              hauteur={8}
            />
            {!objectifAtteint ? (
              <Text
                style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}
              >
                {LIB_RESTE_A_ATTEINDRE} : {formaterFCFA(e.apercu.resteAAtteindre)}
              </Text>
            ) : null}
          </View>
        </Carte>

        {/* Aperçu retrait */}
        <Carte style={styles.apercu}>
          <View style={styles.apercuTete}>
            <Icone nom="eye-outline" taille={18} couleur={theme.couleurs.or} />
            <Text style={[theme.typographie.titre3, { color: theme.couleurs.textePrimaire }]}>
              {LIB_APERCU_TITRE}
            </Text>
          </View>
          <Text
            style={[
              theme.typographie.corps2,
              { color: objectifAtteint ? theme.couleurs.succes : theme.couleurs.avertissement },
            ]}
          >
            {objectifAtteint
              ? LIB_APERCU_RETRAIT_ATTEINT(tauxTexte)
              : LIB_APERCU_RETRAIT_NON_ATTEINT(tauxTexte)}
          </Text>
          <Text
            style={[
              theme.typographie.legende,
              { color: theme.couleurs.texteSecondaire, fontStyle: "italic" },
            ]}
          >
            {LIB_APERCU_MENTION}
          </Text>
          <LigneApercu label={LIB_TAUX} valeur={`${tauxTexte} %`} />
          <LigneApercu
            label={objectifAtteint ? LIB_FRAIS_RETRAIT : LIB_PENALITE}
            valeur={formaterFCFA(e.apercu.penaliteSiRetraitMaintenant)}
            couleur={theme.couleurs.avertissement}
          />
          <LigneApercu
            label={LIB_NET_ESTIME}
            valeur={formaterFCFA(e.apercu.netEstime)}
            couleur={theme.couleurs.succes}
            gras
          />
        </Carte>

        {/* Actions */}
        {estActif ? (
          <>
            <Bouton
              libelle={LIB_DEPOSER}
              onPress={() => router.push(`/projets/${e.id}-deposer`)}
              iconeGauche="add-circle-outline"
            />
            <Bouton
              libelle={LIB_MODIFIER_PROJET}
              variante="secondaire"
              onPress={() => router.push(`/projets/${e.id}-modifier`)}
              iconeGauche="create-outline"
            />
          </>
        ) : null}

        {/* Bouton retrait désactivé */}
        <Bouton
          libelle={`${LIB_RETIRER_PROJET} — ${LIB_RETIRER_BIENTOT}`}
          onPress={() => { }}
          variante="secondaire"
          desactive
          iconeGauche="lock-closed-outline"
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function LigneApercu({
  label,
  valeur,
  couleur,
  gras,
}: {
  label: string;
  valeur: string;
  couleur?: string;
  gras?: boolean;
}) {
  return (
    <View style={styles.ligneApercu}>
      <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire, flex: 1 }]}>
        {label}
      </Text>
      <Text
        style={[
          gras ? theme.typographie.corps2Medium : theme.typographie.corps2,
          { color: couleur ?? theme.couleurs.textePrimaire },
        ]}
      >
        {valeur}
      </Text>
    </View>
  );
}

function libelleStatut(statut: EpargneVue["statut"]): string {
  switch (statut) {
    case "active":
      return LIB_STATUT_ACTIF;
    case "retiree":
      return LIB_STATUT_RETIRE;
    case "cloturee":
      return LIB_STATUT_CLOTURE;
  }
}

const styles = StyleSheet.create({
  racine: {
    flex: 1,
    backgroundColor: theme.couleurs.fond,
  },
  entete: {
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 12,
    paddingBottom: 4,
  },
  contenu: {
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 8,
    gap: theme.espacements.interBloc,
  },
  liste: {
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 8,
    paddingBottom: 48,
    gap: theme.espacements.interBloc,
  },
  cartePrincipale: {
    gap: 10,
  },
  rangeeStatut: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  pastilleStatut: {
    borderRadius: theme.rayons.pilule,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  objectifBloc: {
    gap: 6,
  },
  objectifLigne: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  apercu: {
    gap: 10,
  },
  apercuTete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  ligneApercu: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
});
