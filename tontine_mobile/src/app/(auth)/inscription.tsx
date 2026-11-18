import { useState } from "react";
import { router } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
import { Ecran } from "@/components/Ecran";
import { BandeauRetour } from "@/components/BandeauRetour";
import { Champ } from "@/components/Champ";
import { Bouton } from "@/components/Bouton";
import { Icone } from "@/components/Icone";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/Toast";
import { theme } from "@/theme";
import { ErreurApi } from "@/api";
import { normaliserTelephonePourEnvoi, validerTelephoneBenin, chiffresLocauxSaisis } from "@/utils/telephone";
import { hapticErreur } from "@/utils/haptics";

export default function Inscription() {
  const { sInscrire } = useAuth();
  const { afficher } = useToast();
  const [nom, setNom] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [envoi, setEnvoi] = useState(false);
  const [erreurNom, setErreurNom] = useState<string | null>(null);
  const [erreurPhone, setErreurPhone] = useState<string | null>(null);
  const [erreurPassword, setErreurPassword] = useState<string | null>(null);

  const okLong = password.length >= 8;
  const okLettre = /[a-zA-Z]/.test(password);
  const okChiffre = /\d/.test(password);
  const robuste = okLong && okLettre && okChiffre;

  const soumettre = async () => {
    setErreurNom(null);
    setErreurPhone(null);
    setErreurPassword(null);
    if (nom.trim().length < 2) { setErreurNom("Saisissez votre nom complet."); hapticErreur(); return; }
    if (!validerTelephoneBenin(phone)) { setErreurPhone("Saisissez un numéro à 10 chiffres."); hapticErreur(); return; }
    const phoneNormalise = normaliserTelephonePourEnvoi(phone);
    if (!phoneNormalise) { setErreurPhone("Numéro invalide."); hapticErreur(); return; }
    if (!robuste) { setErreurPassword("Le mot de passe doit comporter 8 caractères, une lettre et un chiffre."); hapticErreur(); return; }

    setEnvoi(true);
    try {
      await sInscrire({ nom: nom.trim(), phone: phoneNormalise, password });
      router.push("/choisir-mise");
    } catch (e) {
      const msg = e instanceof ErreurApi ? e.message : "Inscription impossible. Réessayez.";
      setErreurPhone(msg);
      afficher(msg, "erreur");
    } finally {
      setEnvoi(false);
    }
  };

  return (
    <Ecran>
      <View style={styles.contenu}>
        <BandeauRetour titre="Créer mon compte" />
        <View style={styles.formulaire}>
          <Text style={[theme.typographie.titre, styles.titre]}>Bienvenue parmi nous</Text>
          <Text style={[theme.typographie.corps2, styles.sousTitre, { color: theme.couleurs.texteSecondaire }]}>
            Quelques informations suffisent pour commencer.
          </Text>

          <Champ label="Nom complet" value={nom} onChangeText={setNom} placeholder="Koffi Adjovi" iconeGauche="person-outline" autoCapitalize="words" erreur={erreurNom} />
          <Champ label="Téléphone" prefixe="+229 " clavier="number-pad" maxLength={10} value={phone} onChangeText={(t) => setPhone(chiffresLocauxSaisis(t))} placeholder="01 97 00 00 00" iconeGauche="call-outline" erreur={erreurPhone} />
          <Champ label="Mot de passe" motDePasse value={password} onChangeText={setPassword} placeholder="Au moins 8 caractères" iconeGauche="lock-closed-outline" erreur={erreurPassword} />

          <View style={styles.criteres}>
            <Critere ok={okLong} texte="8 caractères minimum" />
            <Critere ok={okLettre} texte="une lettre" />
            <Critere ok={okChiffre} texte="un chiffre" />
          </View>

          <Bouton libelle="Créer mon compte" chargement={envoi} onPress={soumettre} style={styles.bouton} />
        </View>
      </View>
    </Ecran>
  );
}

function Critere({ ok, texte }: { ok: boolean; texte: string }) {
  return (
    <View style={styles.critere}>
      <Icone nom={ok ? "checkmark-circle" : "ellipse-outline"} taille={16} couleur={ok ? theme.couleurs.succes : theme.couleurs.grisPerdu} />
      <Text style={[theme.typographie.legende, { color: ok ? theme.couleurs.textePrimaire : theme.couleurs.texteSecondaire }]}>{texte}</Text>
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
    marginBottom: 8,
  },
  criteres: {
    flexDirection: "row",
    gap: 16,
    flexWrap: "wrap",
    marginTop: 4,
  },
  critere: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  bouton: {
    marginTop: 8,
  },
});
