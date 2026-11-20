import { useState } from "react";
import { router } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ecran } from "@/components/Ecran";
import { BandeauRetour } from "@/components/BandeauRetour";
import { Champ } from "@/components/Champ";
import { Bouton } from "@/components/Bouton";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import { theme } from "@/theme";
import { ErreurApi } from "@/api";
import { normaliserTelephonePourEnvoi, chiffresLocauxSaisis } from "@/utils/telephone";
import { hapticErreur } from "@/utils/haptics";

export default function Connexion() {
  const { seConnecter } = useAuth();
  const { afficher } = useToast();
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurPhone, setErreurPhone] = useState<string | null>(null);
  const [erreurGlobale, setErreurGlobale] = useState<string | null>(null);

  const soumettre = async () => {
    setErreurPhone(null);
    setErreurGlobale(null);
    const phoneNormalise = normaliserTelephonePourEnvoi(phone);
    if (!phoneNormalise) {
      setErreurPhone("Saisissez un numéro de téléphone valide.");
      hapticErreur();
      return;
    }
    if (!password) {
      setErreurGlobale("Veuillez remplir tous les champs.");
      hapticErreur();
      return;
    }
    setEnvoi(true);
    try {
      await seConnecter({ phone: phoneNormalise, password });
    } catch (e) {
      const msg = e instanceof ErreurApi ? e.message : "Connexion impossible. Réessayez.";
      setErreurGlobale(msg);
      afficher(msg, "erreur");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Ecran>
      <View style={styles.contenu}>
        <BandeauRetour titre="Connexion" />
        <View style={styles.formulaire}>
          <Text style={[theme.typographie.titre, styles.titre]}>Bon retour</Text>
          <Text style={[theme.typographie.corps2, styles.sousTitre, { color: theme.couleurs.texteSecondaire }]}>
            Connectez-vous pour gérer votre cotisation.
          </Text>

          <Champ
            label="Téléphone"
            prefixe="+229 "
            clavier="number-pad"
            maxLength={13}
            value={phone}
            onChangeText={(t) => setPhone(chiffresLocauxSaisis(t))}
            placeholder="01 97 00 00 00"
            iconeGauche="call-outline"
            erreur={erreurPhone}
          />
          <Champ
            label="Mot de passe"
            motDePasse
            value={password}
            onChangeText={setPassword}
            placeholder="Votre mot de passe"
            iconeGauche="lock-closed-outline"
            returnKeyType="go"
            onSubmitEditing={soumettre}
            erreur={erreurGlobale}
            style={styles.champ}
          />

          <Bouton libelle="Me connecter" chargement={envoi} onPress={soumettre} style={styles.bouton} />

          <View style={styles.lien}>
            <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}>Pas encore de compte ? </Text>
            <Pressable onPress={() => router.push("/inscription")} hitSlop={8}>
              <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.primaire }]}>Créer un compte</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Ecran>
  );
}

const styles = StyleSheet.create({
  contenu: {
    flex: 1,
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 8,
  },
  formulaire: {
    paddingTop: 24,
    gap: theme.espacements.interChamp,
  },
  titre: {
    color: theme.couleurs.textePrimaire,
  },
  sousTitre: {
    marginBottom: 8,
  },
  champ: {},
  bouton: {
    marginTop: 8,
  },
  lien: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
});
