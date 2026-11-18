// Déclaration des variables d'environnement publiques (préfixe EXPO_PUBLIC_).
declare global {
  namespace NodeJS {
    interface ProcessEnv {
      /** URL de base de l'API (ex : http://192.168.1.20:3000/api/v1). */
      readonly EXPO_PUBLIC_API_URL?: string;
      /** "true" pour activer le mode démo (données fictives). */
      readonly EXPO_PUBLIC_MODE_DEMO?: string;
    }
  }
}

export {};
