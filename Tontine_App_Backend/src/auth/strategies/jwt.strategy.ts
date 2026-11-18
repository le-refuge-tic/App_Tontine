import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { InjectRepository } from '@nestjs/typeorm';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Repository } from 'typeorm';
import { Membre } from '../../membre/entities/membre.entity';
import { StatutMembre } from '../../common/enums/statut-membre.enum';
import { JwtPayload } from '../interfaces/jwt-payload.interface';

/**
 * Stratégie Passport JWT pour les access tokens.
 * Recharge le membre depuis la base à chaque requête : un membre suspendu
 * perd l'accès immédiatement, sans attendre l'expiration du token.
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    @InjectRepository(Membre)
    private readonly membreRepo: Repository<Membre>,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.get<string>('jwt.secret') ?? '',
      audience: 'tontine-access',
    });
  }

  /**
   * Appelé par Passport après vérification de la signature et de l'expiration.
   * Renvoie le membre complet (sans champs select:false) → posé sur request.user.
   */
  async validate(payload: JwtPayload): Promise<Membre> {
    const membre = await this.membreRepo.findOneBy({ id: payload.sub });

    if (!membre) {
      throw new UnauthorizedException('Jeton invalide : membre introuvable.');
    }
    if (membre.statut === StatutMembre.SUSPENDU) {
      throw new UnauthorizedException('Compte suspendu. Contactez l\'administration.');
    }
    if (membre.statut === StatutMembre.CLOTURE) {
      throw new UnauthorizedException('Compte clôturé.');
    }

    return membre;
  }
}
