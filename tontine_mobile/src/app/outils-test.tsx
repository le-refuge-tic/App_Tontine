/**
 * Écran caché « Outils de test ».
 *
 * Visible UNIQUEMENT si __DEV__ === true ET mode réel (EXPO_PUBLIC_MODE_DEMO=false).
 * Accessible par un appui long sur le titre de l'accueil.
 *
 * Ne pas inclure dans les builds de production :
 * - En mode démo : un message dit que les outils sont inutiles en démo.
 * - En production : __DEV__ est false, l'accès est bloqué à l'écran.
 */
import { useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Bouton } from "@/components/Bouton";
import { Carte } from "@/components/Carte";
import { BandeauRetour } from "@/components/BandeauRetour";
import { theme } from "@/theme";
import { API_URL, EST_MODE_DEMO } from "@/constants/env";
import { dev, transactions, ErreurApi } from "@/api";
import { useAuth } from "@/hooks/useAuth";

export default function OutilsTest() {
  // Bloque l'accès hors dev ou en mode démo.
  if (!__DEV__) {
    return (
      <SafeAreaView style={styles.racine}>
        <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire, padding: 24 }]}>
          Outils de test indisponibles en production.
        </Text>
      </SafeAreaView>
    );
  }

  return <ContenuOutilsTest />;
}

function ContenuOutilsTest() {
  const { membre, etatSession } = useAuth();
  const [statutConnexion, setStatutConnexion] = useState<string | null>(null);
  const [chargementConnexion, setChargementConnexion] = useState(false);
  const [dernierTxId, setDernierTxId] = useState<string>("");
  const [statutSimulation, setStatutSimulation] = useState<string | null>(null);
  const [chargementSim, setChargementSim] = useState(false);

  const testerConnexion = async () => {
    setChargementConnexion(true);
    setStatutConnexion(null);
    const res = await dev.testerConnexionServeur();
    setStatutConnexion(res.ok ? `✓ ${res.message}` : `✗ ${res.message}`);
    setChargementConnexion(false);
  };

  const simuler = async (resultat: "approuve" | "refuse") => {
    const id = parseInt(dernierTxId, 10);
    if (!id || isNaN(id)) {
      setStatutSimulation("Saisissez un ID de transaction valide.");
      return;
    }
    setChargementSim(true);
    setStatutSimulation(null);
    try {
      await dev.simulerWebhook(id, resultat);
      // Récupère le nouveau statut.
      const tx = await transactions.obtenirTransaction(id);
      setStatutSimulation(`Transaction ${id} → ${tx.statut}`);
    } catch (e) {
      setStatutSimulation(e instanceof ErreurApi ? e.message : "Erreur inconnue.");
    } finally {
      setChargementSim(false);
    }
  };

  return (
    <SafeAreaView style={styles.racine} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.contenu}>
        <BandeauRetour titre="Outils de test" />

        {EST_MODE_DEMO && (
          <Carte style={styles.avertissement}>
            <Text style={[theme.typographie.corps2, { color: theme.couleurs.or }]}>
              Mode démo actif — les outils de simulation ne font rien en démo.
            </Text>
          </Carte>
        )}

        {/* URL & statut connexion */}
        <Carte>
          <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.textePrimaire, marginBottom: 8 }]}>
            URL de l'API
          </Text>
          <Text style={[theme.typographie.legende, styles.code]}>
            {API_URL || "(non configurée)"}
          </Text>

          <Bouton
            libelle="Tester la connexion au serveur"
            variante="secondaire"
            iconeGauche="wifi-outline"
            chargement={chargementConnexion}
            onPress={testerConnexion}
            style={{ marginTop: 12 }}
          />
          {statutConnexion ? (
            <Text style={[theme.typographie.corps2, { color: theme.couleurs.textePrimaire, marginTop: 8 }]}>
              {statutConnexion}
            </Text>
          ) : null}
        </Carte>

        {/* Statut de session */}
        <Carte>
          <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.textePrimaire, marginBottom: 8 }]}>
            Session
          </Text>
          <LigneInfo label="État" valeur={etatSession} />
          <LigneInfo label="Membre" valeur={membre ? `${membre.nom} (id ${membre.id})` : "—"} />
          <LigneInfo label="Rôle" valeur={membre?.role ?? "—"} />
        </Carte>

        {/* Simulation de webhook */}
        <Carte>
          <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.textePrimaire, marginBottom: 8 }]}>
            Simuler un webhook FedaPay
          </Text>
          <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire, marginBottom: 12 }]}>
            Utile quand le tunnel cloudflared est coupé. Saisissez l'ID de la transaction à simuler.
          </Text>

          <View style={styles.rangee}>
            <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.textePrimaire, marginBottom: 6 }]}>
              ID de transaction
            </Text>
          </View>
          <View style={styles.champsId}>
            <Text
              style={[styles.inputId, theme.typographie.corps2]}
              suppressHighlighting
            >
              {dernierTxId || "—"}
            </Text>
          </View>

          {/* Boutons +/- rapides */}
          <View style={styles.rangeeChiffres}>
            {["1","2","3","4","5","6","7","8","9","0"].map((c) => (
              <Bouton
                key={c}
                libelle={c}
                variante="secondaire"
                plein={false}
                onPress={() => setDernierTxId((p) => (p.length < 10 ? p + c : p))}
                style={styles.chiffreBtn}
              />
            ))}
            <Bouton
              libelle="⌫"
              variante="secondaire"
              plein={false}
              onPress={() => setDernierTxId((p) => p.slice(0, -1))}
              style={styles.chiffreBtn}
            />
          </View>

          <View style={styles.boutonsSimu}>
            <Bouton
              libelle="Simuler : approuvé"
              iconeGauche="checkmark-circle-outline"
              chargement={chargementSim}
              onPress={() => simuler("approuve")}
              style={{ flex: 1 }}
            />
            <Bouton
              libelle="Simuler : refusé"
              variante="secondaire"
              iconeGauche="close-circle-outline"
              chargement={chargementSim}
              onPress={() => simuler("refuse")}
              style={{ flex: 1 }}
            />
          </View>

          {statutSimulation ? (
            <Text style={[theme.typographie.corps2, { color: theme.couleurs.textePrimaire, marginTop: 8 }]}>
              {statutSimulation}
            </Text>
          ) : null}
        </Carte>

        <Bouton libelle="Fermer" variante="secondaire" onPress={() => router.back()} style={{ marginTop: 8 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

function LigneInfo({ label, valeur }: { label: string; valeur: string }) {
  return (
    <View style={styles.ligneInfo}>
      <Text style={[theme.typographie.corps2, { color: theme.couleurs.texteSecondaire, flex: 1 }]}>{label}</Text>
      <Text style={[theme.typographie.corps2Medium, { color: theme.couleurs.textePrimaire }]}>{valeur}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  racine: {
    flex: 1,
    backgroundColor: theme.couleurs.fond,
  },
  contenu: {
    padding: theme.espacements.contenu,
    gap: theme.espacements.interBloc,
    paddingBottom: 48,
  },
  avertissement: {
    backgroundColor: theme.couleurs.orClair,
  },
  code: {
    fontFamily: "PlusJakartaSans_400Regular",
    color: theme.couleurs.primaire,
    backgroundColor: theme.couleurs.primaireTresClair,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  ligneInfo: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    gap: 8,
  },
  rangee: {},
  champsId: {
    backgroundColor: theme.couleurs.surface,
    borderRadius: 10,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.couleurs.bordure,
  },
  inputId: {
    color: theme.couleurs.textePrimaire,
    minHeight: 24,
  },
  rangeeChiffres: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 12,
  },
  chiffreBtn: {
    width: 44,
    minHeight: 40,
  },
  boutonsSimu: {
    flexDirection: "row",
    gap: 8,
  },
});
