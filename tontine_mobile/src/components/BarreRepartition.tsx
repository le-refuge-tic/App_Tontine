import { StyleSheet, View, Text } from "react-native";
import { theme } from "@/theme";
import { formaterFCFA } from "@/utils/formaterFCFA";

interface Props {
  retirable: number | null;
  fondsCaisse: number;
  bloque: number;
}

interface Segment {
  couleur: string;
  libelle: string;
  montant: number | null;
}

export function BarreRepartition({ retirable, fondsCaisse, bloque }: Props) {
  const segments: Segment[] = [
    { couleur: theme.couleurs.primaire, libelle: "Retirable", montant: retirable },
    { couleur: theme.couleurs.or, libelle: "Fonds de caisse retenu", montant: fondsCaisse },
    { couleur: theme.couleurs.grisPerdu, libelle: "Bloqué", montant: bloque },
  ];

  const total = segments.reduce((s, seg) => s + (seg.montant ?? 0), 0);

  return (
    <View>
      <View style={styles.barre}>
        {total > 0
          ? segments.map((seg, i) =>
              seg.montant && seg.montant > 0 ? (
                <View
                  key={i}
                  style={[
                    styles.segment,
                    {
                      flex: seg.montant,
                      backgroundColor: seg.couleur,
                      borderTopLeftRadius: i === 0 ? 999 : 0,
                      borderBottomLeftRadius: i === 0 ? 999 : 0,
                      borderTopRightRadius: i === segments.length - 1 ? 999 : 0,
                      borderBottomRightRadius: i === segments.length - 1 ? 999 : 0,
                    },
                  ]}
                />
              ) : null,
            )
          : <View style={styles.barreVide} />}
      </View>

      <View style={styles.legende}>
        {segments.map((seg, i) => (
          <View key={i} style={styles.legendeItem}>
            <View style={[styles.point, { backgroundColor: seg.couleur }]} />
            <Text style={[theme.typographie.legende, styles.legendeLibelle]}>
              {seg.libelle}
            </Text>
            <Text style={[theme.typographie.legende, styles.legendeMontant]}>
              {seg.montant === null ? "—" : formaterFCFA(seg.montant)}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  barre: {
    flexDirection: "row",
    height: 12,
    borderRadius: 999,
    overflow: "hidden",
    backgroundColor: theme.couleurs.bordure,
  },
  barreVide: {
    flex: 1,
  },
  segment: {
    height: "100%",
  },
  legende: {
    marginTop: 14,
    gap: 8,
  },
  legendeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  point: {
    width: 10,
    height: 10,
    borderRadius: 5,
    flexShrink: 0,
  },
  legendeLibelle: {
    color: theme.couleurs.texteSecondaire,
    flex: 1,
    flexShrink: 1,
  },
  legendeMontant: {
    color: theme.couleurs.textePrimaire,
    flexShrink: 0,
  },
});
