import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Stack, router, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useFonts } from "expo-font";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StatusBar } from "expo-status-bar";
import { theme } from "@/theme";
import { NOM_APP } from "@/constants/app";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ToastProvider } from "@/components/Toast";
import { useEtatSouscription } from "@/hooks/useRequetes";
import { Bouton } from "@/components/Bouton";

SplashScreen.preventAutoHideAsync().catch(() => {});

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      refetchOnWindowFocus: true,
    },
  },
});

export default function RootLayout() {
  const [policesChargees] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
  });

  if (!policesChargees) return null;

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="dark" />
          <RacineApp />
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * RacineApp : le Stack est rendu UNE SEULE FOIS et ne se démonte plus jamais.
 * Le splash est caché quand la session ET la souscription sont connues (ou
 * après 6 s de délai maximum). Pendant l'attente, un écran opaque en JS
 * recouvre le Stack pour masquer les transitions intermédiaires — c'est un
 * overlay positionné en absolu, pas un démontage du Stack.
 */
function RacineApp() {
  const { etatSession } = useAuth();
  const etatSouscription = useEtatSouscription();

  // "prêt" : vrai dès qu'on sait où rediriger l'utilisateur.
  //   - Déconnecté : dès que etatSession est connu (pas besoin de la souscription).
  //   - Connecté   : quand la souscription est aussi connue (oui / non).
  // Une fois passé à true, ne repasse JAMAIS à false.
  const [splashCaché, setSplashCaché] = useState(false);
  const [depasse, setDepasse] = useState(false);
  // Ref pour s'assurer qu'on n'appelle hideAsync qu'une seule fois.
  const hideCalledRef = useRef(false);

  // Délai de 6 s : déblocage de secours si la souscription ne répond pas.
  useEffect(() => {
    if (etatSession !== "connecte") return;
    const t = setTimeout(() => setDepasse(true), 6000);
    return () => clearTimeout(t);
  }, [etatSession]);

  const sessionConnue = etatSession !== "chargement";
  const souscriptionConnue =
    etatSession === "deconnecte" || etatSouscription !== "inconnu" || depasse;
  const pret = sessionConnue && souscriptionConnue;

  useEffect(() => {
    if (pret && !hideCalledRef.current) {
      hideCalledRef.current = true;
      SplashScreen.hideAsync().catch(() => {});
      setSplashCaché(true);
    }
  }, [pret]);

  return (
    <>
      {/* Le Stack est toujours monté, GateNavigation gère les redirections. */}
      <GateNavigation />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(onboarding)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="profil" options={{ presentation: "card" }} />
        <Stack.Screen name="notifications" options={{ presentation: "card" }} />
      </Stack>

      {/*
       * Overlay opaque : recouvre le Stack pendant que le splash est encore
       * visible (session ou souscription pas encore connues). Disparaît dès
       * que splashCaché = true. Toujours monté mais invisible après, donc
       * aucun démontage de Stack.
       */}
      {!splashCaché && (
        <View style={stylesOverlay.fond} pointerEvents="none" />
      )}

      {/*
       * Écran d'erreur réseau : affiché si la souscription a dépassé 6 s.
       * Positionné en absolu par-dessus le Stack — le Stack reste intact.
       */}
      {splashCaché && depasse && etatSession === "connecte" && etatSouscription === "inconnu" && (
        <EcranChargementBloque />
      )}
    </>
  );
}

function EcranChargementBloque() {
  const { seDeconnecter } = useAuth();

  return (
    <View style={stylesAttente.fond}>
      <Text style={[theme.typographie.titre, stylesAttente.nom]}>{NOM_APP}</Text>
      <ActivityIndicator color={theme.couleurs.primaire} style={stylesAttente.indicateur} />
      <Text style={[theme.typographie.corps2, stylesAttente.message]}>
        Connexion impossible. Vérifiez votre réseau.
      </Text>
      <Bouton
        libelle="Réessayer"
        variante="secondaire"
        iconeGauche="refresh-outline"
        onPress={() => void seDeconnecter()}
        style={stylesAttente.bouton}
      />
    </View>
  );
}

const stylesOverlay = StyleSheet.create({
  fond: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.couleurs.fond,
    zIndex: 100,
  },
});

const stylesAttente = StyleSheet.create({
  fond: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: theme.couleurs.fond,
    zIndex: 100,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: theme.espacements.contenu,
    gap: 16,
  },
  nom: {
    color: theme.couleurs.primaireFonce,
  },
  indicateur: {
    marginVertical: 8,
  },
  message: {
    color: theme.couleurs.texteSecondaire,
    textAlign: "center",
  },
  bouton: {
    minWidth: 160,
    marginTop: 8,
  },
});

/** Portail de redirection selon l'authentification et la souscription active. */
function GateNavigation() {
  const { etatSession, membre } = useAuth();
  const etatSouscription = useEtatSouscription();
  const segments = useSegments();

  const estAuthentifie = etatSession === "connecte";
  const estAdmin = membre?.role === "admin";

  useEffect(() => {
    if (etatSession === "chargement") return;
    if (etatSouscription === "inconnu") return;

    const segment0 = segments[0] as string | undefined;
    const dansAuth = segment0 === "(auth)";

    if (!estAuthentifie) {
      if (!dansAuth) router.replace("/bienvenue");
      return;
    }
    // L'admin n'a pas de souscription : on le laisse sur l'accueil
    // sans jamais le renvoyer vers choisir-mise.
    if (estAdmin) {
      if (dansAuth || segment0 === "(onboarding)") router.replace("/");
      return;
    }
    if (etatSouscription === "non") {
      const dansOnboarding = segment0 === "(onboarding)";
      if (!dansOnboarding) router.replace("/choisir-mise");
    } else {
      if (dansAuth || segment0 === "(onboarding)") router.replace("/");
    }
  }, [estAuthentifie, estAdmin, etatSession, etatSouscription, segments]);

  return null;
}
