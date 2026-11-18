import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Request } from 'express';
import { Membre } from '../../membre/entities/membre.entity';

/**
 * Injecte le membre authentifié depuis la requête (positionné par JwtStrategy).
 *
 * Usage dans un controller :
 *   @Get('moi')
 *   getMe(@UtilisateurCourant() membre: Membre) { ... }
 */
export const UtilisateurCourant = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): Membre => {
    const request = ctx.switchToHttp().getRequest<Request & { user: Membre }>();
    return request.user;
  },
);
