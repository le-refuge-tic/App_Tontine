import { Body, Controller, Get, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import { InscriptionDto } from './dto/inscription.dto';
import { ConnexionDto } from './dto/connexion.dto';
import { RafraichirDto } from './dto/rafraichir.dto';
import { ChangerPasswordDto } from './dto/changer-password.dto';
import { DefinirCodeRetraitDto } from './dto/definir-code-retrait.dto';
import { VerifierCodeRetraitDto } from './dto/verifier-code-retrait.dto';
import { Public } from '../common/decorators/public.decorator';
import { UtilisateurCourant } from '../common/decorators/utilisateur-courant.decorator';
import { Membre } from '../membre/entities/membre.entity';

/** Limite stricte pour les routes d'authentification sensibles (10 req / 60 s). */
const THROTTLE_AUTH = { default: { ttl: 60000, limit: 10 } };

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // ── Routes publiques ─────────────────────────────────────────────

  @Public()
  @Throttle(THROTTLE_AUTH)
  @Post('inscription')
  @ApiOperation({ summary: 'Inscription d\'un nouveau membre.' })
  inscrire(@Body() dto: InscriptionDto) {
    return this.authService.inscrire(dto);
  }

  @Public()
  @Throttle(THROTTLE_AUTH)
  @Post('connexion')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Connexion par téléphone + mot de passe.' })
  seConnecter(@Body() dto: ConnexionDto) {
    return this.authService.seConnecter(dto);
  }

  @Public()
  @Throttle(THROTTLE_AUTH)
  @Post('rafraichir')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Rotation du jeton de rafraîchissement. L\'ancien est révoqué, un nouveau couple est émis.',
  })
  rafraichir(@Body() dto: RafraichirDto) {
    return this.authService.rafraichir(dto.refreshToken);
  }

  // ── Routes protégées (JWT requis) ────────────────────────────────

  @Post('deconnexion')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Révoque le jeton de rafraîchissement fourni.' })
  seDeconnecter(@Body() dto: RafraichirDto) {
    return this.authService.seDeconnecter(dto.refreshToken);
  }

  @Get('moi')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Renvoie le membre connecté.' })
  moi(@UtilisateurCourant() membre: Membre) {
    return membre;
  }

  @Post('changer-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Change le mot de passe. Révoque tous les refresh tokens.' })
  changerPassword(
    @UtilisateurCourant() membre: Membre,
    @Body() dto: ChangerPasswordDto,
  ) {
    return this.authService.changerPassword(membre.id, dto);
  }

  @Post('code-retrait')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Définit ou change le code de retrait (4 à 6 chiffres).' })
  definirCodeRetrait(
    @UtilisateurCourant() membre: Membre,
    @Body() dto: DefinirCodeRetraitDto,
  ) {
    return this.authService.definirCodeRetrait(membre.id, dto);
  }

  @Throttle(THROTTLE_AUTH)
  @Post('code-retrait/verifier')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary:
      'Vérifie le code de retrait. Si correct, renvoie un jeton de retrait à courte durée de vie.',
  })
  verifierCodeRetrait(
    @UtilisateurCourant() membre: Membre,
    @Body() dto: VerifierCodeRetraitDto,
  ) {
    return this.authService.verifierCodeRetrait(membre.id, dto.codeRetrait);
  }
}
