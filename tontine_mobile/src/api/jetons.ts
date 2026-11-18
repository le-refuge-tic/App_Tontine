import * as SecureStore from "expo-secure-store";

// Stockage sécurisé des jetons (expo-secure-store v58 : API asynchrone). Jamais journalisés.

const CLE_ACCESS = "tontine_access_token";
const CLE_REFRESH = "tontine_refresh_token";

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CLE_ACCESS);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(CLE_REFRESH);
}

export async function setJetons(accessToken: string, refreshToken: string): Promise<void> {
  await SecureStore.setItemAsync(CLE_ACCESS, accessToken);
  await SecureStore.setItemAsync(CLE_REFRESH, refreshToken);
}

export async function effacerJetons(): Promise<void> {
  await SecureStore.deleteItemAsync(CLE_ACCESS).catch(() => {});
  await SecureStore.deleteItemAsync(CLE_REFRESH).catch(() => {});
}
