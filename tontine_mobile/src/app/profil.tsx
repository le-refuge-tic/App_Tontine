import { useState } from "react";
import { Alert, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BandeauRetour } from "@/components/BandeauRetour";
import { Carte } from "@/components/Carte";
import { Bouton } from "@/components/Bouton";
import { Champ } from "@/components/Champ";
import { ClavierCode } from "@/components/ClavierCode";
import { FeuilleBasse } from "@/components/FeuilleBasse";
import { LigneMenu } from "@/components/LigneMenu";
import { useToast } from "@/components/Toast";
import { theme } from "@/theme";
import { VERSION_APP } from "@/constants/app";
import { useAuth } from "@/hooks/useAuth";
import { useChangerPassword, useDefinirCodeRetrait } from "@/hooks/useRequetes";
import { ErreurApi } from "@/api";
import { formaterTelephoneAffichage } from "@/utils/telephone";
import { hapticSucces, hapticErreur, hapticSelection } from "@/utils/haptics";

type FeuilleModeType = "code" | "password" | null;

export default function Profil() {
  const { membre, seDeconnecter } = useAuth();
  const { afficher } = useToast();
  const changerPassword = useChangerPassword();
  const definirCode = useDefinirCodeRetrait();

  const [feuille, setFeuille] = useState<FeuilleModeType>(null);
  const [reinitCode, setReinitCode] = useState(0);
  const [erreurCode, setErreurCode] = useState<string | null>(null);

  // Formulaire changement de password
  const [ancienPwd, setAncienPwd] = useState("");
  const [nouveauPwd, setNouveauPwd] = useState("");
  const [erreurPwd, setErreurPwd] = useState<string | null>(null);

  // Formulaire définition du code (password confirmé + code saisi)
  const [pwdPourCode, setPwdPourCode] = useState("");
  const [etapeCode, setEtapeCode] = useState<"password" | "code">("password");

  const surDeconnexion = () => {
    Alert.alert(
      "Déconnexion",
      "Voulez-vous vraiment vous déconnecter ?",
      [
        { text: "Annuler", style: "cancel" },
        {
          text: "Déconnexion",
          style: "destructive",
          onPress: async () => {
            hapticSelection();
            await seDeconnecter();
          },
        },
      ],
    );
  };

  const surChangerPassword = async () => {
    if (nouveauPwd.length < 8 || !/[a-zA-Z]/.test(nouveauPwd) || !/\d/.test(nouveauPwd)) {
      setErreurPwd("8 caractères minimum, une lettre et un chiffre.");
      hapticErreur();
      return;
    }
    setErreurPwd(null);
    try {
      await changerPassword.mutateAsync({ ancienPassword: ancienPwd, nouveauPassword: nouveauPwd });
      hapticSucces();
      setFeuille(null);
      setAncienPwd("");
      setNouveauPwd("");
      afficher("Mot de passe modifié avec succès.", "succes");
    } catch (e) {
      const msg = e instanceof ErreurApi ? e.message : "Impossible de changer le mot de passe.";
      setErreurPwd(msg);
      afficher(msg, "erreur");
      hapticErreur();
    }
  };

  const surDefinirCode = async (code: string) => {
    setErreurCode(null);
    try {
      await definirCode.mutateAsync({ password: pwdPourCode, codeRetrait: code });
      hapticSucces();
      setFeuille(null);
      setPwdPourCode("");
      setEtapeCode("password");
      afficher("Code de retrait défini.", "succes");
    } catch (e) {
      const msg = e instanceof ErreurApi ? e.message : "Impossible de définir le code.";
      setErreurCode(msg);
      setReinitCode((n) => n + 1);
      hapticErreur();
    }
  };

  const ouvrirFeutilleCode = () => {
    setEtapeCode("password");
    setPwdPourCode("");
    setErreurCode(null);
    setFeuille("code");
  };

  return (
    <>
      <SafeAreaView style={styles.racine} edges={["top"]}>
        <ScrollView contentContainerStyle={styles.liste} showsVerticalScrollIndicator={false}>
          <View style={styles.entete}>
            <BandeauRetour titre="Mon profil" />
          </View>

          {/* Identité */}
          <Carte style={styles.identite}>
            <View style={styles.avatar}>
              <Text style={[theme.typographie.montantMoyen, { color: theme.couleurs.primaireFonce }]}>
                {(membre?.nom?.[0] ?? "?").toUpperCase()}
              </Text>
            </View>
            <Text style={[theme.typographie.titre2, { color: theme.couleurs.textePrimaire }]}>{membre?.nom ?? "—"}</Text>
            {membre?.phone ? (
              <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire }]}>
                {formaterTelephoneAffichage(membre.phone)}
              </Text>
            ) : null}
          </Carte>

          {/* Actions : chaque rangée est sa propre carte */}
          <LigneMenu
            icone="keypad-outline"
            libelle="Définir / changer mon code de retrait"
            onPress={ouvrirFeutilleCode}
          />
          <LigneMenu
            icone="lock-closed-outline"
            libelle="Changer mon mot de passe"
            onPress={() => {
              setFeuille("password");
              setAncienPwd("");
              setNouveauPwd("");
              setErreurPwd(null);
            }}
          />

          <Bouton libelle="Se déconnecter" variante="danger" iconeGauche="log-out-outline" onPress={surDeconnexion} style={styles.boutonDeco} />

          <Text style={[theme.typographie.legende, styles.version, { color: theme.couleurs.grisPerdu }]}>
            Version {VERSION_APP}
          </Text>
        </ScrollView>
      </SafeAreaView>

      {/* Feuille : changement de mot de passe */}
      <FeuilleBasse visible={feuille === "password"} onClose={() => setFeuille(null)}>
        <Text style={[theme.typographie.titre2, styles.feuilleT]}>Changer le mot de passe</Text>
        <Champ label="Mot de passe actuel" motDePasse value={ancienPwd} onChangeText={setAncienPwd} iconeGauche="lock-closed-outline" style={styles.champ} />
        <Champ label="Nouveau mot de passe" motDePasse value={nouveauPwd} onChangeText={setNouveauPwd} iconeGauche="lock-open-outline" erreur={erreurPwd} style={styles.champ} />
        <Bouton libelle="Confirmer" chargement={changerPassword.isPending} onPress={surChangerPassword} style={styles.champ} />
      </FeuilleBasse>

      {/* Feuille : définir code de retrait */}
      <FeuilleBasse visible={feuille === "code"} onClose={() => setFeuille(null)}>
        {etapeCode === "password" ? (
          <>
            <Text style={[theme.typographie.titre2, styles.feuilleT]}>Code de retrait</Text>
            <Text style={[theme.typographie.corps2, styles.feuilleS, { color: theme.couleurs.texteSecondaire }]}>
              Confirmez votre mot de passe pour continuer.
            </Text>
            <Champ motDePasse value={pwdPourCode} onChangeText={setPwdPourCode} label="Mot de passe" iconeGauche="lock-closed-outline" style={styles.champ} />
            <Bouton libelle="Continuer" onPress={() => { if (pwdPourCode.length > 0) setEtapeCode("code"); }} style={styles.champ} />
          </>
        ) : (
          <ClavierCode
            longueur={4}
            titre="Choisissez un code à 4 chiffres"
            sousTitre="Ce code sera demandé à chaque retrait."
            erreur={erreurCode}
            cleReinit={reinitCode}
            onComplet={surDefinirCode}
          />
        )}
      </FeuilleBasse>
    </>
  );
}


const styles = StyleSheet.create({
  racine: {
    flex: 1,
    backgroundColor: theme.couleurs.fond,
  },
  liste: {
    paddingHorizontal: theme.espacements.contenu,
    paddingBottom: 48,
    gap: theme.espacements.interCarte,
  },
  entete: {
    paddingTop: 8,
  },
  identite: {
    alignItems: "center",
    gap: 8,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: theme.couleurs.primaireTresClair,
    alignItems: "center",
    justifyContent: "center",
  },
  boutonDeco: {},
  version: {
    textAlign: "center",
    marginTop: 4,
  },
  feuilleT: {
    color: theme.couleurs.textePrimaire,
    marginBottom: 8,
  },
  feuilleS: {
    marginBottom: 12,
  },
  champ: {
    marginTop: 10,
  },
});
