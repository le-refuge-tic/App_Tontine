import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Ecran } from "@/components/Ecran";
import { Carte } from "@/components/Carte";
import { Champ } from "@/components/Champ";
import { Bouton } from "@/components/Bouton";
import { BandeauRetour } from "@/components/BandeauRetour";
import { EtatErreur } from "@/components/EtatErreur";
import { CarteSquelette } from "@/components/Squelette";
import { useToast } from "@/components/Toast";
import { theme } from "@/theme";
import {
  LIB_MODIFIER_PROJET,
  LIB_NOM_PROJET,
  LIB_OBJECTIF,
  LIB_MODIF_REUSSIE,
  LIB_OBJECTIF_NON_MODIFIABLE,
} from "@/constants/libelles";
import { useEpargne, useModifierEpargne } from "@/hooks/useRequetes";
import { ErreurApi } from "@/api";
import { hapticSucces, hapticErreur } from "@/utils/haptics";
import type { EpargneVue } from "@/api/types";

export default function ModifierProjet() {
  const { id } = useLocalSearchParams<{ id: string }>();
  // La route est `/projets/42-modifier` → id = "42-modifier", extraire l'entier.
  const idNum = parseInt(String(id), 10);

  const epargneQ = useEpargne(isNaN(idNum) ? null : idNum);

  if (epargneQ.isPending) {
    return (
      <Ecran paddingBas={24}>
        <View style={styles.contenu}>
          <BandeauRetour titre={LIB_MODIFIER_PROJET} />
          <CarteSquelette />
        </View>
      </Ecran>
    );
  }

  if (epargneQ.isError || !epargneQ.data) {
    return (
      <Ecran paddingBas={24}>
        <View style={styles.contenu}>
          <BandeauRetour titre={LIB_MODIFIER_PROJET} />
          <EtatErreur
            message="Impossible de charger ce projet."
            onReessayer={() => epargneQ.refetch()}
          />
        </View>
      </Ecran>
    );
  }

  return <Formulaire epargne={epargneQ.data} idNum={idNum} />;
}

function Formulaire({ epargne, idNum }: { epargne: EpargneVue; idNum: number }) {
  const modifierEpargne = useModifierEpargne();
  const { afficher } = useToast();

  const [nom, setNom] = useState(epargne.nom);
  const [objectif, setObjectif] = useState(String(epargne.objectifMontant));
  const [erreurs, setErreurs] = useState<Record<string, string>>({});

  // L'objectif est modifiable uniquement si aucun dépôt n'a encore réussi :
  // montant = 0 ET objectifAtteintLe est null.
  const objectifModifiable = epargne.montant === 0 && epargne.objectifAtteintLe === null;

  const soumettre = async () => {
    const errs: Record<string, string> = {};
    if (nom.trim().length < 2 || nom.trim().length > 100) {
      errs.nom = "Le nom doit comporter entre 2 et 100 caractères.";
    }
    if (objectifModifiable) {
      const n = Number(objectif);
      if (!Number.isInteger(n) || n < 1) {
        errs.objectif = "L'objectif doit être un entier ≥ 1.";
      }
    }
    if (Object.keys(errs).length > 0) {
      setErreurs(errs);
      return;
    }
    setErreurs({});
    try {
      const params: { nom: string; objectifMontant?: number } = {
        nom: nom.trim(),
      };
      if (objectifModifiable) {
        params.objectifMontant = Number(objectif);
      }
      await modifierEpargne.mutateAsync({ id: idNum, params });
      hapticSucces();
      afficher(LIB_MODIF_REUSSIE, "succes");
      router.back();
    } catch (e) {
      // Afficher les erreurs du serveur telles quelles (409, etc.)
      const msg =
        e instanceof ErreurApi
          ? e.message
          : e instanceof Error
            ? e.message
            : String(e);
      setErreurs({ _serveur: msg });
      hapticErreur();
      afficher(msg, "erreur");
    }
  };

  return (
    <Ecran paddingBas={24}>
      <View style={styles.contenu}>
        <BandeauRetour titre={LIB_MODIFIER_PROJET} />

        <Champ
          label={LIB_NOM_PROJET}
          value={nom}
          onChangeText={setNom}
          autoCapitalize="sentences"
          maxLength={100}
          erreur={erreurs.nom}
          iconeGauche="pencil-outline"
        />

        <Champ
          label={LIB_OBJECTIF}
          value={objectif}
          onChangeText={objectifModifiable ? setObjectif : () => {}}
          clavier="number-pad"
          erreur={erreurs.objectif}
          iconeGauche="flag-outline"
          editable={objectifModifiable}
        />
        {!objectifModifiable ? (
          <Text style={[theme.typographie.corps2, styles.aideGrisee]}>
            {LIB_OBJECTIF_NON_MODIFIABLE}
          </Text>
        ) : null}

        {erreurs._serveur ? (
          <Carte>
            <EtatErreur
              message={erreurs._serveur}
              onReessayer={() => setErreurs({})}
            />
          </Carte>
        ) : null}

        <Bouton
          libelle="Enregistrer"
          onPress={soumettre}
          chargement={modifierEpargne.isPending}
          iconeGauche="checkmark-outline"
        />

        <Bouton
          libelle="Annuler"
          variante="secondaire"
          onPress={() => router.back()}
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
  aideGrisee: {
    color: theme.couleurs.texteSecondaire,
    marginTop: -8,
  },
});
