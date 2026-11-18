import { SetMetadata } from '@nestjs/common';

/** Clé de métadonnée utilisée par JwtAuthGuard pour détecter les routes publiques. */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Marque une route comme publique : JwtAuthGuard la laisse passer sans JWT.
 * À utiliser uniquement sur les routes explicitement ouvertes (inscription,
 * connexion, rafraîchissement, endpoint webhook FedaPay).
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
