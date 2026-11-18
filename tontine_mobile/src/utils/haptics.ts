import * as Haptics from "expo-haptics";

// Enveloppes autour d'expo-haptics. Les erreurs sont ignorées (haptics parfois
// indisponible, notamment sur émulateur).

function ignorer(): ((e: unknown) => void) {
  return () => {};
}

export function hapticLeger(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(ignorer());
}
export function hapticMoyen(): void {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(ignorer());
}
export function hapticSelection(): void {
  Haptics.selectionAsync().catch(ignorer());
}
export function hapticSucces(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(ignorer());
}
export function hapticErreur(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(ignorer());
}
export function hapticAvertissement(): void {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(ignorer());
}
