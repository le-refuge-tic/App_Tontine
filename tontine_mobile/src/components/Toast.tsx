import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View, Text, Pressable } from "react-native";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { theme } from "@/theme";
import { Icone, type NomIcone } from "./Icone";

export type TypeToast = "info" | "succes" | "erreur" | "avertissement";

interface ToastItem {
  id: number;
  message: string;
  type: TypeToast;
}

interface ContexteToast {
  afficher: (message: string, type?: TypeToast) => void;
}

const ToastContext = createContext<ContexteToast | null>(null);

const COULEUR_ACCENT: Record<TypeToast, string> = {
  info: theme.couleurs.primaire,
  succes: theme.couleurs.succes,
  erreur: theme.couleurs.danger,
  avertissement: theme.couleurs.avertissement,
};

const ICONE: Record<TypeToast, NomIcone> = {
  info: "information-circle-outline",
  succes: "checkmark-circle-outline",
  erreur: "alert-circle-outline",
  avertissement: "warning-outline",
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const afficher = useCallback((message: string, type: TypeToast = "info") => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  return (
    <ToastContext.Provider value={{ afficher }}>
      {children}
      <View style={styles.conteneur} pointerEvents="box-none">
        {toasts.map((t) => (
          <Animated.View
            key={t.id}
            entering={FadeIn.duration(160)}
            exiting={FadeOut.duration(220)}
          >
            <Pressable onPress={() => setToasts((lst) => lst.filter((x) => x.id !== t.id))}>
              <ToastElement toast={t} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </ToastContext.Provider>
  );
}

/** Un toast individuel avec tremblement au montage. */
function ToastElement({ toast }: { toast: ToastItem }) {
  const decalage = useSharedValue(0);

  useEffect(() => {
    // Tremblement horizontal : 6 allers-retours rapides puis retour au centre.
    const d = 7; // amplitude en pixels
    const t = 45; // durée d'un demi-cycle en ms
    decalage.value = withSequence(
      withTiming( d, { duration: t }),
      withTiming(-d, { duration: t }),
      withTiming( d, { duration: t }),
      withTiming(-d, { duration: t }),
      withTiming( d, { duration: t }),
      withTiming(-d, { duration: t }),
      withTiming(0, { duration: t }),
    );
  }, [decalage]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateX: decalage.value }],
  }));

  const couleur = COULEUR_ACCENT[toast.type];

  return (
    <Animated.View
      style={[styles.toast, { borderLeftColor: couleur }, anim]}
    >
      <Icone nom={ICONE[toast.type]} taille={26} couleur={couleur} style={styles.icone} />
      <Text
        style={[theme.typographie.corpsMedium, styles.texte]}
        maxFontSizeMultiplier={1.2}
      >
        {toast.message}
      </Text>
    </Animated.View>
  );
}

export function useToast(): ContexteToast {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast doit être utilisé dans un ToastProvider");
  return ctx;
}

const styles = StyleSheet.create({
  conteneur: {
    position: "absolute",
    top: 52,
    left: 0,
    right: 0,
    alignItems: "center",
    paddingHorizontal: 16,
    gap: 10,
    // zIndex élevé pour passer au-dessus de tout
    zIndex: 999,
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: theme.couleurs.surface,
    borderRadius: 18,
    paddingHorizontal: 20,
    paddingVertical: 20,
    borderLeftWidth: 5,
    ...theme.ombres.carteElevee,
    maxWidth: 460,
    width: "100%",
  },
  icone: {
    flexShrink: 0,
  },
  texte: {
    color: theme.couleurs.textePrimaire,
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
  },
});
