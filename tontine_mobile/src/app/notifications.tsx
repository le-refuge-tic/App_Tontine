import { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Animated, { FadeIn } from "react-native-reanimated";
import { BandeauRetour } from "@/components/BandeauRetour";
import { EtatVide } from "@/components/EtatVide";
import { EtatErreur } from "@/components/EtatErreur";
import { ListeSquelette } from "@/components/Squelette";
import { Icone } from "@/components/Icone";
import { theme } from "@/theme";
import { useNotifications, useMarquerLue } from "@/hooks/useRequetes";
import { formaterRelatif } from "@/utils/dates";
import type { Notification } from "@/api/types";

export default function NotificationsEcran() {
  const { data, isPending, isError, refetch } = useNotifications();
  const marquerLue = useMarquerLue();
  const [rafraichit, setRafraichit] = useState(false);

  const rafraichir = async () => {
    setRafraichit(true);
    await refetch();
    setRafraichit(false);
  };

  return (
    <SafeAreaView style={styles.racine} edges={["top"]}>
      <View style={styles.entete}>
        <BandeauRetour titre="Notifications" />
      </View>
      {isPending ? (
        <View style={styles.corps}><ListeSquelette nombre={5} /></View>
      ) : isError ? (
        <EtatErreur message="Impossible de charger les notifications." onReessayer={refetch} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.liste}
          refreshControl={<RefreshControl refreshing={rafraichit} onRefresh={rafraichir} tintColor={theme.couleurs.primaire} />}
          showsVerticalScrollIndicator={false}
        >
          {(data ?? []).length === 0 ? (
            <EtatVide icone="notifications-outline" titre="Aucune notification" message="Vos rappels et confirmations apparaîtront ici." />
          ) : (
            (data ?? []).map((n) => (
              <Animated.View key={n.id} entering={FadeIn.duration(200)}>
                <TouchableOpacity activeOpacity={0.7} onPress={() => { if (!n.lue) marquerLue.mutate(n.id); }}>
                  <LigneNotification notif={n} />
                </TouchableOpacity>
              </Animated.View>
            ))
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function LigneNotification({ notif }: { notif: Notification }) {
  const { couleurs, typographie } = theme;
  return (
    <View style={[styles.ligne, !notif.lue && styles.ligneNonLue]}>
      <View style={[styles.rondIcone, { backgroundColor: notif.lue ? couleurs.bordure : couleurs.primaireTresClair }]}>
        <Icone
          nom={notif.type === "retrait_effectue" ? "arrow-up-circle-outline" : "notifications-outline"}
          taille={20}
          couleur={notif.lue ? couleurs.grisPerdu : couleurs.primaire}
        />
      </View>
      <View style={styles.texte}>
        <Text style={[typographie.corps2Medium, { color: couleurs.textePrimaire }]}>{notif.message}</Text>
        <Text style={[typographie.legende, { color: couleurs.texteSecondaire, marginTop: 4 }]}>{formaterRelatif(notif.date)}</Text>
      </View>
      {!notif.lue ? <View style={styles.pointNonLu} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  racine: {
    flex: 1,
    backgroundColor: theme.couleurs.fond,
  },
  entete: {
    paddingHorizontal: theme.espacements.contenu,
    paddingTop: 8,
    paddingBottom: 4,
  },
  corps: {
    paddingHorizontal: theme.espacements.contenu,
  },
  liste: {
    paddingHorizontal: theme.espacements.contenu,
    paddingBottom: 32,
    gap: 4,
  },
  ligne: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: theme.couleurs.surface,
    borderRadius: 16,
    padding: 14,
  },
  ligneNonLue: {
    backgroundColor: theme.couleurs.primaireTresClair,
  },
  rondIcone: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  texte: {
    flex: 1,
    minWidth: 0,
  },
  pointNonLu: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.couleurs.primaire,
    marginTop: 6,
  },
});
