import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ecran } from "@/components/Ecran";
import { BandeauRetour } from "@/components/BandeauRetour";
import { Carte } from "@/components/Carte";
import { SelecteurMise } from "@/components/SelecteurMise";
import { ControleSegmente, type OptionSegmente } from "@/components/ControleSegmente";
import { Bouton } from "@/components/Bouton";
import { Icone, type NomIcone } from "@/components/Icone";
import { useToast } from "@/components/Toast";
import { theme } from "@/theme";
import { MISE_MINIMALE, PAS_MISE, PUCES_MISE } from "@/constants/app";
import { formaterFCFA } from "@/utils/formaterFCFA";
import { useCreerSouscription } from "@/hooks/useRequetes";
import { ErreurApi } from "@/api";
import type { Regularite } from "@/api/types";
import { hapticSucces } from "@/utils/haptics";

const OPTIONS_REGULARITE: OptionSegmente[] = [
  { valeur: "jour", libelle: "Jour" },
  { valeur: "semaine", libelle: "Semaine" },
  { valeur: "mois", libelle: "Mois" },
];

export default function ChoisirMise() {
  const [mise, setMise] = useState(500);
  const [regularite, setRegularite] = useState<Regularite>("jour");
  const creer = useCreerSouscription();
  const { afficher } = useToast();

  // `mise` est toujours une valeur valide (mise à jour uniquement quand SelecteurMise
  // valide, via onChange). Le bouton est désactivé si la valeur est sous MISE_MINIMALE
  // (cas initial impossible si les puces partent de 500, mais sécurité).
  const miseValide = mise >= MISE_MINIMALE;

  const commencer = async () => {
    if (!miseValide) return;
    try {
      await creer.mutateAsync({ miseBase: mise, regularite });
      hapticSucces();
      // Ne pas naviguer ici : GateNavigation détecte la nouvelle souscription
      // dès que useEtatSouscription repasse à "oui" et redirige vers l'accueil.
    } catch (e) {
      const msg = e instanceof ErreurApi ? e.message : "Impossible de démarrer la cotisation.";
      afficher(msg, "erreur");
    }
  };

  return (
    <Ecran>
      <View style={styles.contenu}>
        <BandeauRetour titre="Choisir ma mise" />
        <View style={styles.formulaire}>
          <Text style={[theme.typographie.titre2, styles.titre]}>Combien cotisez-vous ?</Text>
          <Text style={[theme.typographie.corps2, styles.sousTitre, { color: theme.couleurs.texteSecondaire }]}>
            Vous pourrez ajuster plus tard.
          </Text>

          <SelecteurMise valeur={mise} onChange={setMise} minimum={MISE_MINIMALE} pas={PAS_MISE} puces={PUCES_MISE} />

          <Text style={[theme.typographie.corps2Medium, styles.label, { color: theme.couleurs.texteSecondaire }]}>
            Régularité
          </Text>
          <ControleSegmente options={OPTIONS_REGULARITE} valeur={regularite} onChange={(v) => setRegularite(v as Regularite)} />

          <Carte style={styles.recap}>
            <LigneRecap icone="cash-outline" label="À chaque paiement" valeur={formaterFCFA(mise)} />
            <View style={styles.separateur} />
            <LigneRecap icone="lock-closed-outline" label="Fonds de caisse (non rendu)" valeur="Retenu chaque cycle" secondaire />
          </Carte>

          <View style={styles.note}>
            <Icone nom="information-circle-outline" taille={18} couleur={theme.couleurs.texteSecondaire} />
            <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire, flex: 1 }]}>
              Chaque mois compte 31 jours de paiement. Les mois plus courts ont un ou plusieurs jours doublés.
            </Text>
          </View>
        </View>

        <View style={styles.bas}>
          <Bouton libelle="Commencer ma cotisation" chargement={creer.isPending} desactive={!miseValide} onPress={commencer} iconeDroite="arrow-forward-outline" />
        </View>
      </View>
    </Ecran>
  );
}

function LigneRecap({ icone, label, valeur, secondaire }: { icone: NomIcone; label: string; valeur: string; secondaire?: boolean }) {
  return (
    <View style={styles.ligneRecap}>
      <View style={styles.ligneRecapGauche}>
        <Icone nom={icone} taille={20} couleur={theme.couleurs.primaire} style={{ flexShrink: 0 }} />
        <Text
          style={[theme.typographie.corps2Medium, { color: theme.couleurs.textePrimaire, flex: 1, flexShrink: 1 }]}
          numberOfLines={2}
        >
          {label}
        </Text>
      </View>
      <Text
        style={[
          secondaire ? theme.typographie.corps2 : theme.typographie.montantPetit,
          { color: secondaire ? theme.couleurs.texteSecondaire : theme.couleurs.textePrimaire, flexShrink: 0 },
        ]}
        numberOfLines={2}
      >
        {valeur}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  contenu: {
    flex: 1,
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 8,
  },
  formulaire: {
    paddingTop: 16,
    gap: theme.espacements.interChamp,
  },
  titre: {
    color: theme.couleurs.textePrimaire,
  },
  sousTitre: {
    marginBottom: 4,
  },
  label: {
    marginTop: 8,
  },
  recap: {
    marginTop: 4,
  },
  ligneRecap: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    gap: 8,
  },
  ligneRecapGauche: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  separateur: {
    height: 1,
    backgroundColor: theme.couleurs.bordure,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  bas: {
    paddingVertical: 24,
  },
});
