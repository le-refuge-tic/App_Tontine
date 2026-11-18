import { ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { Observable } from 'rxjs';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';

/**
 * Guard JWT global. Toutes les routes exigent un access token valide SAUF celles
 * marquées @Public(). Un token manquant ou invalide renvoie HTTP 401.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context) as boolean | Promise<boolean> | Observable<boolean>;
  }

  /** Surcharge pour renvoyer un message d'erreur en français. */
  handleRequest<TUser>(err: Error | null, user: TUser): TUser {
    if (err || !user) {
      throw new UnauthorizedException(
        "Accès refusé : jeton d'accès manquant ou invalide.",
      );
    }
    return user;
  }
}
