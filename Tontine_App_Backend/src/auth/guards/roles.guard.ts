import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { Role } from '../../common/enums/role.enum';
import { Membre } from '../../membre/entities/membre.entity';

/**
 * Guard de rôles. S'exécute après JwtAuthGuard (request.user est déjà positionné).
 * Si la route porte @Roles(...), seuls les membres avec ce rôle peuvent accéder.
 * Un membre sans le rôle requis reçoit HTTP 403.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const rolesRequis = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // Pas de restriction de rôle sur cette route.
    if (!rolesRequis || rolesRequis.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request & { user?: Membre }>();
    const membre = request.user;

    if (!membre) {
      return false;
    }

    if (!rolesRequis.includes(membre.role)) {
      throw new ForbiddenException(
        "Accès refusé : vous n'avez pas les droits nécessaires pour cette action.",
      );
    }

    return true;
  }
}
