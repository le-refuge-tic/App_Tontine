import { SetMetadata } from '@nestjs/common';
import { Role } from '../enums/role.enum';

/** Clé de métadonnée utilisée par RolesGuard. */
export const ROLES_KEY = 'roles';

/**
 * Restreint une route à un ou plusieurs rôles.
 * Exemple : @Roles(Role.ADMIN)
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
