import { Tabs } from "expo-router";
import { BarreOngletsFlottante } from "@/components/BarreOngletsFlottante";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{ headerShown: false }}
      tabBar={(props) => <BarreOngletsFlottante {...props} />}
    >
      <Tabs.Screen name="index" options={{ title: "Accueil" }} />
      <Tabs.Screen name="cotiser" options={{ title: "Cotiser" }} />
      <Tabs.Screen name="retirer" options={{ title: "Retirer" }} />
      <Tabs.Screen name="rapport" options={{ title: "Rapport" }} />
    </Tabs>
  );
}
