import { Role } from '../../common/enums/role.enum';

/**
 * Payload de l'access token JWT.
 * - sub  : identifiant du membre (standard JWT « subject »)
 * - role : rôle du membre (membre | admin)
 */
export interface JwtPayload {
  sub: number;
  role: Role;
}

/**
 * Payload du jeton de retrait (courte durée de vie, audience différente).
 * - sub     : identifiant du membre
 * - purpose : toujours 'retrait' (vérification côté guard à l'étape suivante)
 */
export interface JwtRetraitPayload {
  sub: number;
  purpose: 'retrait';
}
