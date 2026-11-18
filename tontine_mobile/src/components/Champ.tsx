import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  View,
  type KeyboardTypeOptions,
  type ReturnKeyTypeOptions,
  type ViewStyle,
} from "react-native";
import { Pressable } from "react-native";
import { theme } from "@/theme";
import { Icone, type NomIcone } from "./Icone";

interface Props {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  erreur?: string | null;
  iconeGauche?: NomIcone;
  /** Préfixe fixe affiché (ex : "+229"). */
  prefixe?: string;
  /** Active le bouton d'affichage/masquage (mot de passe). */
  motDePasse?: boolean;
  clavier?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  returnKeyType?: ReturnKeyTypeOptions;
  maxLength?: number;
  editable?: boolean;
  onSubmitEditing?: () => void;
  style?: ViewStyle;
}

export function Champ({
  label,
  value,
  onChangeText,
  placeholder,
  erreur,
  iconeGauche,
  prefixe,
  motDePasse = false,
  clavier = "default",
  autoCapitalize = "none",
  returnKeyType = "done",
  maxLength,
  editable = true,
  onSubmitEditing,
  style,
}: Props) {
  const [focus, setFocus] = useState(false);
  const [visible, setVisible] = useState(false);
  const c = theme.couleurs;

  const bordure = erreur ? c.danger : focus ? c.primaire : c.bordure;

  return (
    <View style={style}>
      {label ? <Text style={[theme.typographie.corps2Medium, styles.label, { color: c.texteSecondaire }]}>{label}</Text> : null}
      <View style={[styles.conteneur, { borderColor: bordure, backgroundColor: c.surface }]}>
        {iconeGauche ? <Icone nom={iconeGauche} taille={20} couleur={focus ? c.primaire : c.texteSecondaire} style={styles.icone} /> : null}
        {prefixe ? <Text style={[theme.typographie.corpsMedium, { color: c.textePrimaire }]}>{prefixe}</Text> : null}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={c.grisPerdu}
          secureTextEntry={motDePasse && !visible}
          keyboardType={clavier}
          autoCapitalize={autoCapitalize}
          autoCorrect={false}
          returnKeyType={returnKeyType}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setFocus(true)}
          onBlur={() => setFocus(false)}
          onSubmitEditing={onSubmitEditing}
          style={[theme.typographie.corpsMedium, styles.input, { color: editable ? c.textePrimaire : c.texteSecondaire }]}
        />
        {motDePasse ? (
          <Pressable onPress={() => setVisible((v) => !v)} hitSlop={8} accessibilityLabel={visible ? "Masquer" : "Afficher"}>
            <Icone nom={visible ? "eye-off-outline" : "eye-outline"} taille={20} couleur={c.texteSecondaire} style={styles.icone} />
          </Pressable>
        ) : null}
      </View>
      {erreur ? <Text style={[theme.typographie.legende, styles.erreur, { color: c.danger }]}>{erreur}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    marginBottom: 6,
  },
  conteneur: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: theme.rayons.champ,
    paddingHorizontal: 14,
    minHeight: 56,
  },
  icone: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
  },
  erreur: {
    marginTop: 6,
  },
});
