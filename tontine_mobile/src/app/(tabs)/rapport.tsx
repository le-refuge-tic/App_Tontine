import { useState } from "react";
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ControleSegmente, type OptionSegmente } from "@/components/ControleSegmente";
import { LigneOperation } from "@/components/LigneOperation";
import { EtatVide } from "@/components/EtatVide";
import { EtatErreur } from "@/components/EtatErreur";
import { Icone } from "@/components/Icone";
import { Carte } from "@/components/Carte";
import { ListeSquelette, Squelette } from "@/components/Squelette";
import { theme } from "@/theme";
import { useRapport } from "@/hooks/useRequetes";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { formaterMoisAnnee, maintenantComposants, composantsDepuisIso, formaterDateCourte } from "@/utils/dates";
import { hapticSelection } from "@/utils/haptics";
import type { EcritureComptable } from "@/api/types";

const FILTRES: OptionSegmente[] = [
  { valeur: "tout", libelle: "Tout" },
  { valeur: "cotisations", libelle: "Cotisations" },
  { valeur: "retraits", libelle: "Retraits" },
];

type Filtre = "tout" | "cotisations" | "retraits";

function moisISO(annee: number, mois: number): string {
  // mois est 0-indexé (comme Date.getMonth)
  return `${annee}-${String(mois + 1).padStart(2, "0")}`;
}

export default function Rapport() {
  const maintenant = maintenantComposants();
  const [filtre, setFiltre] = useState<Filtre>("tout");
  const [mois, setMois] = useState({ annee: maintenant.annee, mois: maintenant.mois });
  const [rafraichit, setRafraichit] = useState(false);

  const moisStr = moisISO(mois.annee, mois.mois);
  const rapportQ = useRapport(moisStr, filtre);

  const allerMoisPrecedent = () => {
    hapticSelection();
    setMois((m) =>
      m.mois === 0 ? { annee: m.annee - 1, mois: 11 } : { annee: m.annee, mois: m.mois - 1 },
    );
  };
  const allerMoisSuivant = () => {
    hapticSelection();
    setMois((m) =>
      m.mois === 11 ? { annee: m.annee + 1, mois: 0 } : { annee: m.annee, mois: m.mois + 1 },
    );
  };

  const rafraichir = async () => {
    setRafraichit(true);
    await rapportQ.refetch();
    setRafraichit(false);
  };

  // Totaux fournis par le serveur.
  const totaux = rapportQ.data?.totaux ?? { cotise: 0, retire: 0, fondsRetenu: 0 };

  // Écritures du rapport (déjà filtrées côté serveur).
  const ecritures: EcritureComptable[] = rapportQ.data?.ecritures ?? [];

  // Groupement par jour.
  const parJour = new Map<string, { label: string; items: EcritureComptable[] }>();
  ecritures.forEach((e) => {
    const c = composantsDepuisIso(e.date);
    const k = `${c.annee}-${c.mois}-${c.jour}`;
    if (!parJour.has(k)) parJour.set(k, { label: formaterDateCourte(e.date), items: [] });
    parJour.get(k)!.items.push(e);
  });
  const sections = Array.from(parJour.values()).map((v) => ({ title: v.label, data: v.items }));

  return (
    <SafeAreaView style={styles.racine} edges={["top"]}>
      <View style={styles.entete}>
        <Text style={[theme.typographie.titre3, styles.entetetitre]} numberOfLines={1} maxFontSizeMultiplier={1.2}>
          Rapport
        </Text>

        {/* Sélecteur de mois */}
        <View style={styles.selecteurMois}>
          <Pressable onPress={allerMoisPrecedent} hitSlop={12} accessibilityLabel="Mois précédent">
            <Icone nom="chevron-back" taille={24} couleur={theme.couleurs.textePrimaire} />
          </Pressable>
          <Text style={[theme.typographie.corpsMedium, { color: theme.couleurs.textePrimaire }]} maxFontSizeMultiplier={1.2}>
            {formaterMoisAnnee(mois)}
          </Text>
          <Pressable onPress={allerMoisSuivant} hitSlop={12} accessibilityLabel="Mois suivant">
            <Icone nom="chevron-forward" taille={24} couleur={theme.couleurs.textePrimaire} />
          </Pressable>
        </View>
      </View>

      <ControleSegmente
        options={FILTRES}
        valeur={filtre}
        onChange={(v) => setFiltre(v as Filtre)}
        style_wrapper={styles.filtreConteneur}
      />

      {rapportQ.isPending ? (
        <View style={styles.corps}>
          <Squelette width="100%" height={80} rayon={14} />
          <ListeSquelette nombre={6} />
        </View>
      ) : rapportQ.isError ? (
        <EtatErreur message="Impossible de charger les opérations." onReessayer={() => rapportQ.refetch()} />
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(e) => String(e.id)}
          renderItem={({ item }) => <LigneOperation ecriture={item} />}
          renderSectionHeader={({ section: { title } }) => (
            <View style={styles.enteteSection}>
              <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.texteSecondaire }]}>{title}</Text>
            </View>
          )}
          ListHeaderComponent={() => (
            <View style={styles.tuiles}>
              <Tuile label="Cotisé" montant={totaux.cotise} icone="arrow-down-circle-outline" couleur={theme.couleurs.succes} />
              <Tuile label="Retiré" montant={totaux.retire} icone="arrow-up-circle-outline" couleur={theme.couleurs.texteSecondaire} />
              <Tuile label="Fonds retenu" montant={totaux.fondsRetenu} icone="lock-closed-outline" couleur={theme.couleurs.or} />
            </View>
          )}
          ListEmptyComponent={() => (
            <EtatVide icone="receipt-outline" titre="Aucune opération" message="Aucune opération pour ce mois ou ce filtre." />
          )}
          refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={theme.couleurs.primaire} />}
          contentContainerStyle={styles.liste}
          stickySectionHeadersEnabled={false}
        />
      )}
    </SafeAreaView>
  );
}

function Tuile({
  label,
  montant,
  icone,
  couleur,
}: {
  label: string;
  montant: number;
  icone: import("@/components/Icone").NomIcone;
  couleur: string;
}) {
  return (
    <Carte style={styles.tuile}>
      <Icone nom={icone} taille={22} couleur={couleur} />
      <Text style={[theme.typographie.montantPetit, { color: theme.couleurs.textePrimaire }]}>{formaterFCFA(montant)}</Text>
      <Text style={[theme.typographie.legende, { color: theme.couleurs.texteSecondaire }]}>{label}</Text>
    </Carte>
  );
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
    paddingBottom: 8,
    gap: 8,
  },
  entetetitre: {
    color: theme.couleurs.textePrimaire,
    flexShrink: 1,
  },
  selecteurMois: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flexShrink: 0,
  },
  filtreConteneur: {
    marginHorizontal: theme.espacements.contenu,
    marginBottom: 12,
  },
  corps: {
    paddingHorizontal: theme.espacements.contenu,
    gap: 16,
  },
  liste: {
    paddingHorizontal: theme.espacements.contenu,
    paddingBottom: 96,
  },
  tuiles: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 16,
  },
  tuile: {
    flex: 1,
    padding: 12,
    gap: 4,
    alignItems: "flex-start",
  },
  enteteSection: {
    paddingVertical: 8,
    paddingTop: 14,
  },
});
