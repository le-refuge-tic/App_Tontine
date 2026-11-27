import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { Carte } from "@/components/Carte";
import { Bouton } from "@/components/Bouton";
import { EtatVide } from "@/components/EtatVide";
import { EtatErreur } from "@/components/EtatErreur";
import { BarreProgression } from "@/components/BarreProgression";
import { CarteSquelette } from "@/components/Squelette";
import { theme } from "@/theme";
import { useEpargnes } from "@/hooks/useRequetes";
import { formaterFCFA } from "@/utils/formaterFCFA";
import {
  LIB_PROJETS,
  LIB_NOUVEAU_PROJET,
  LIB_AUCUN_PROJET,
  LIB_AUCUN_PROJET_MSG,
  LIB_STATUT_ACTIF,
  LIB_STATUT_RETIRE,
  LIB_STATUT_CLOTURE,
  LIB_OBJECTIF_COURT,
  LIB_OBJECTIF_ATTEINT_BADGE,
  LIB_RESTE_A_ATTEINDRE,
} from "@/constants/libelles";
import type { EpargneVue } from "@/api/types";

export default function Projets() {
  const epargnes = useEpargnes();
  const [rafraichit, setRafraichit] = useState(false);

  const rafraichir = async () => {
    setRafraichit(true);
    await epargnes.refetch();
    setRafraichit(false);
  };

  return (
    <SafeAreaView style={styles.racine} edges={["top"]}>
      <View style={styles.entete}>
        <Text style={[theme.typographie.titre3, styles.titre]} numberOfLines={1}>
          {LIB_PROJETS}
        </Text>
        <Bouton
          libelle={LIB_NOUVEAU_PROJET}
          onPress={() => router.push("/projets/nouveau")}
          iconeGauche="add-outline"
          plein={false}
          style={styles.boutonNouveau}
        />
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
        {epargnes.isPending ? (
          <View style={styles.squelettes}>
            <CarteSquelette />
            <CarteSquelette />
          </View>
        ) : epargnes.isError ? (
          <EtatErreur
            message="Impossible de charger vos projets."
            onReessayer={() => epargnes.refetch()}
          />
        ) : (epargnes.data ?? []).length === 0 ? (
          <EtatVide
            icone="wallet-outline"
            titre={LIB_AUCUN_PROJET}
            message={LIB_AUCUN_PROJET_MSG}
            action={
              <Bouton
                libelle={LIB_NOUVEAU_PROJET}
                onPress={() => router.push("/projets/nouveau")}
                iconeGauche="add-outline"
                style={{ marginTop: 12 }}
              />
            }
          />
        ) : (
          <Animated.View entering={FadeIn.duration(300)} style={styles.cartes}>
            {(epargnes.data ?? []).map((e) => (
              <CarteProjet key={e.id} epargne={e} />
            ))}
          </Animated.View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CarteProjet({ epargne }: { epargne: EpargneVue }) {
  const statut = libelleStatut(epargne.statut);
  const couleurStatut =
    epargne.statut === "active"
      ? theme.couleurs.succes
      : theme.couleurs.texteSecondaire;
  const objectifAtteint = epargne.apercu.objectifAtteint;

  return (
    <Carte
      onPress={() => router.push(`/projets/${epargne.id}`)}
      style={styles.carteProjet}
    >
      {/* En-tête : nom + pastilles statut */}
      <View style={styles.carteTete}>
        <Text
          style={[theme.typographie.titre3, { color: theme.couleurs.textePrimaire, flex: 1 }]}
          numberOfLines={1}
        >
          {epargne.nom}
        </Text>
        <View style={[styles.pastilleStatut, { backgroundColor: couleurStatut + "22" }]}>
          <Text style={[theme.typographie.legende, { color: couleurStatut }]}>{statut}</Text>
        </View>
      </View>

      {/* Badge objectif atteint */}
      {objectifAtteint ? (
        <View style={[styles.pastilleObjectif, { backgroundColor: theme.couleurs.or + "33" }]}>
          <Text style={[theme.typographie.legende, { color: theme.couleurs.or }]}>
            {LIB_OBJECTIF_ATTEINT_BADGE}
          </Text>
        </View>
      ) : null}

      {/* Montant */}
      <Text style={[theme.typographie.montantMoyen, { color: theme.couleurs.textePrimaire }]}>
        {formaterFCFA(epargne.montant)}
      </Text>

      {/* Objectif et barre de progression */}
      <View style={styles.objectifBloc}>
        <View style={styles.objectifLigne}>
          <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}>
            {LIB_OBJECTIF_COURT} : {formaterFCFA(epargne.objectifMontant)}
          </Text>
          <Text
            style={[theme.typographie.corps2Medium, { color: theme.couleurs.primaire }]}
          >
            {epargne.progressionPourcent} %
          </Text>
        </View>
        <BarreProgression
          valeur={epargne.progressionPourcent / 100}
          couleurRemplissage={objectifAtteint ? theme.couleurs.or : theme.couleurs.primaire}
        />
        {!objectifAtteint ? (
          <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}>
            {LIB_RESTE_A_ATTEINDRE} : {formaterFCFA(epargne.apercu.resteAAtteindre)}
          </Text>
        ) : null}
      </View>
    </Carte>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 12,
    paddingBottom: 10,
    gap: 8,
  },
  titre: {
    color: theme.couleurs.textePrimaire,
    flex: 1,
  },
  boutonNouveau: {
    flexShrink: 0,
  },
  liste: {
    paddingHorizontal: theme.espacements.contenu,
    paddingBottom: 100,
    flexGrow: 1,
  },
  squelettes: {
    gap: theme.espacements.interBloc,
  },
  cartes: {
    gap: theme.espacements.interBloc,
  },
  carteProjet: {
    gap: 10,
  },
  carteTete: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  pastilleStatut: {
    borderRadius: theme.rayons.pilule,
    paddingHorizontal: 10,
    paddingVertical: 3,
    flexShrink: 0,
  },
  pastilleObjectif: {
    alignSelf: "flex-start",
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
});
