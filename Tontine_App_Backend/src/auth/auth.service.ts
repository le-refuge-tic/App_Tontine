import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { Membre } from '../membre/entities/membre.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { JetonRafraichissementService } from '../jeton-rafraichissement/jeton-rafraichissement.service';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { Role, StatutMembre } from '../common/enums';
import { JwtPayload, JwtRetraitPayload } from './interfaces/jwt-payload.interface';
import { InscriptionDto } from './dto/inscription.dto';
import { ConnexionDto } from './dto/connexion.dto';
import { ChangerPasswordDto } from './dto/changer-password.dto';
import { DefinirCodeRetraitDto } from './dto/definir-code-retrait.dto';

/** Hash bcrypt factice utilisé pour égaliser le temps de réponse quand le phone est inconnu. */
const HASH_FACTICE =
  '$2b$12$invalidhashfacticeXXXXXXXXXXXXXXXXXXXXXXXXXXXXX';

/** Préfixe téléphonique du Bénin. */
const PREFIXE_BENIN = '229';
/** Longueur d'un numéro local béninois (sans préfixe). */
const LONGUEUR_LOCALE = 10;

/**
 * Normalise un numéro de téléphone vers le format de stockage : 229 + 10 chiffres.
 * Accepte :
 *   - 10 chiffres locaux          (0197000000)
 *   - 13 chiffres avec préfixe    (2290197000000)
 *   - Formats avec +, espaces, tirets (nettoyés automatiquement)
 * Pour tout autre longueur les chiffres bruts sont retournés tels quels
 * (rétro-compatibilité Swagger / anciens comptes).
 */
export function normaliserPhone(phone: string): string {
  const chiffres = phone.replace(/[\s+\-]/g, '');
  if (chiffres.length === LONGUEUR_LOCALE) {
    return `${PREFIXE_BENIN}${chiffres}`;
  }
  if (
    chiffres.length === PREFIXE_BENIN.length + LONGUEUR_LOCALE &&
    chiffres.startsWith(PREFIXE_BENIN)
  ) {
    return chiffres;
  }
  // Longueur inattendue : on renvoie les chiffres bruts pour ne pas
  // rejeter des comptes créés en dehors du format standard.
  return chiffres;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ConnexionResult extends TokenPair {
  membre: Membre;
}

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(Membre)
    private readonly membreRepo: Repository<Membre>,
    @InjectRepository(Portefeuille)
    private readonly portefeuilleRepo: Repository<Portefeuille>,
    private readonly jetonService: JetonRafraichissementService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly parametres: ParametreSystemeService,
  ) {}

  // ─────────────────────────────────────────────
  //  Inscription
  // ─────────────────────────────────────────────

  /**
   * Inscrit un nouveau membre avec rôle 'membre' (jamais configurable par le client).
   * Crée son portefeuille dans la même transaction, puis émet les deux jetons.
   */
  async inscrire(dto: InscriptionDto): Promise<ConnexionResult> {
    const phone = normaliserPhone(dto.phone);
    const rounds = this.config.get<number>('bcrypt.rounds') ?? 12;

    const hashedPassword = await bcrypt.hash(dto.password, rounds);

    const membre = await this.membreRepo.manager.transaction(async (manager) => {
      const mRepo = manager.getRepository(Membre);
      const pRepo = manager.getRepository(Portefeuille);

      const nouveau = mRepo.create({
        nom: dto.nom,
        phone,
        password: hashedPassword,
        role: Role.MEMBRE,          // forcé côté serveur
        statut: StatutMembre.ACTIF, // forcé côté serveur
      });
      const saved = await mRepo.save(nouveau);

      const portefeuille = pRepo.create({
        soldeCotisation: 0,
        soldeEpargne: 0,
        soldeBloque: 0,
        membre: saved,
      });
      await pRepo.save(portefeuille);

      return saved;
    });

    const tokens = await this.emettrePaire(membre);
    return { membre, ...tokens };
  }

  // ─────────────────────────────────────────────
  //  Connexion
  // ─────────────────────────────────────────────

  /**
   * Vérifie phone + password avec protection anti-énumération et anti-bruteforce.
   * Message d'erreur UNIQUE et générique quelle que soit la raison de l'échec
   * (phone inconnu vs mauvais password).
   */
  async seConnecter(dto: ConnexionDto): Promise<ConnexionResult> {
    const phone = normaliserPhone(dto.phone);

    // Charge le membre avec les colonnes select:false nécessaires à la vérification.
    const membre = await this.membreRepo
      .createQueryBuilder('m')
      .addSelect('m.password')
      .addSelect('m.tentativesConnexionEchouees')
      .addSelect('m.connexionBloqueeJusqua')
      .where('m.phone = :phone', { phone })
      .getOne();

    // ---- Protection anti-bruteforce ----
    if (membre?.connexionBloqueeJusqua && membre.connexionBloqueeJusqua > new Date()) {
      const restantMs = membre.connexionBloqueeJusqua.getTime() - Date.now();
      const restantMin = Math.ceil(restantMs / 60000);
      throw new HttpException(
        `Trop de tentatives. Réessayez dans ${restantMin} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ---- Anti-énumération : compare toujours un hash, même si le membre est absent ----
    const hashAComparer = membre?.password ?? HASH_FACTICE;
    const passwordOk = await bcrypt.compare(dto.password, hashAComparer);

    if (!membre || !passwordOk) {
      // Incrémente le compteur uniquement si le membre existe
      if (membre) {
        await this.incrementerTentativesConnexion(membre);
      }
      throw new UnauthorizedException('Identifiants invalides.');
    }

    // ---- Vérification du statut (APRÈS le check password pour ne pas révéler l'existence) ----
    if (membre.statut === StatutMembre.SUSPENDU) {
      throw new UnauthorizedException('Compte suspendu. Contactez l\'administration.');
    }
    if (membre.statut === StatutMembre.CLOTURE) {
      throw new UnauthorizedException('Compte clôturé.');
    }

    // Connexion réussie : réinitialise le compteur
    await this.membreRepo.update(membre.id, {
      tentativesConnexionEchouees: 0,
      connexionBloqueeJusqua: null,
    });

    const tokens = await this.emettrePaire(membre);
    return { membre, ...tokens };
  }

  // ─────────────────────────────────────────────
  //  Rafraîchissement avec rotation
  // ─────────────────────────────────────────────

  /**
   * Rotation du refresh token :
   * - L'ancien est révoqué.
   * - Un nouveau couple est émis.
   * - Si l'ancien était déjà révoqué → détection de vol → révocation totale.
   */
  async rafraichir(refreshTokenBrut: string): Promise<TokenPair> {
    const jeton = await this.jetonService.trouverActif(refreshTokenBrut);

    if (!jeton) {
      // Peut-être un token révoqué réutilisé → on tente de trouver le membre
      // pour révoquer toute sa famille (best-effort, sans exposer d'info).
      const hash = this.jetonService.hash(refreshTokenBrut);
      const jetonRevoqu = await this.jetonService['repo']?.findOne({
        where: { hashJeton: hash },
        relations: { membre: true },
      });
      if (jetonRevoqu?.membre) {
        await this.jetonService.revoquerTousPourMembre(jetonRevoqu.membre.id);
      }
      throw new UnauthorizedException('Jeton de rafraîchissement invalide ou expiré.');
    }

    // Vérification d'expiration (double-check)
    if (jeton.expireLe < new Date()) {
      await this.jetonService.revoquer(refreshTokenBrut);
      throw new UnauthorizedException('Jeton de rafraîchissement expiré.');
    }

    const membre = jeton.membre;
    if (membre.statut !== StatutMembre.ACTIF) {
      await this.jetonService.revoquer(refreshTokenBrut);
      throw new UnauthorizedException('Compte inactif.');
    }

    // Rotation : révoque l'ancien, émet un nouveau
    await this.jetonService.revoquer(refreshTokenBrut);
    return this.emettrePaire(membre);
  }

  // ─────────────────────────────────────────────
  //  Déconnexion
  // ─────────────────────────────────────────────

  async seDeconnecter(refreshTokenBrut: string): Promise<void> {
    await this.jetonService.revoquer(refreshTokenBrut);
  }

  // ─────────────────────────────────────────────
  //  Changer le mot de passe
  // ─────────────────────────────────────────────

  async changerPassword(membreId: number, dto: ChangerPasswordDto): Promise<void> {
    const membre = await this.membreRepo
      .createQueryBuilder('m')
      .addSelect('m.password')
      .addSelect('m.codeRetrait')
      .where('m.id = :id', { id: membreId })
      .getOne();

    if (!membre) throw new NotFoundException('Membre introuvable.');

    const ancienOk = await bcrypt.compare(dto.ancienPassword, membre.password);
    if (!ancienOk) throw new UnauthorizedException('Ancien mot de passe incorrect.');

    // Refuse un nouveau password identique au codeRetrait actuel
    if (membre.codeRetrait) {
      const identique = await bcrypt.compare(dto.nouveauPassword, membre.codeRetrait);
      if (identique) {
        throw new BadRequestException(
          'Le nouveau mot de passe ne peut pas être identique au code de retrait.',
        );
      }
    }

    const rounds = this.config.get<number>('bcrypt.rounds') ?? 12;
    const hash = await bcrypt.hash(dto.nouveauPassword, rounds);
    await this.membreRepo.update(membreId, { password: hash });
    await this.jetonService.revoquerTousPourMembre(membreId);
  }

  // ─────────────────────────────────────────────
  //  Définir / changer le code de retrait
  // ─────────────────────────────────────────────

  async definirCodeRetrait(membreId: number, dto: DefinirCodeRetraitDto): Promise<void> {
    const membre = await this.membreRepo
      .createQueryBuilder('m')
      .addSelect('m.password')
      .where('m.id = :id', { id: membreId })
      .getOne();

    if (!membre) throw new NotFoundException('Membre introuvable.');

    const passwordOk = await bcrypt.compare(dto.password, membre.password);
    if (!passwordOk) throw new UnauthorizedException('Mot de passe incorrect.');

    if (dto.codeRetrait === dto.password) {
      throw new BadRequestException('Le code de retrait doit être différent du mot de passe.');
    }

    // Vérification supplémentaire : compare le code brut avec le hash du password
    const identique = await bcrypt.compare(dto.codeRetrait, membre.password);
    if (identique) {
      throw new BadRequestException('Le code de retrait doit être différent du mot de passe.');
    }

    const rounds = this.config.get<number>('bcrypt.rounds') ?? 12;
    const hash = await bcrypt.hash(dto.codeRetrait, rounds);
    await this.membreRepo.update(membreId, { codeRetrait: hash });
  }

  // ─────────────────────────────────────────────
  //  Vérification du code de retrait
  // ─────────────────────────────────────────────

  /**
   * Vérifie le code de retrait avec blocage anti-bruteforce.
   * Si correct, retourne un jeton JWT à courte durée de vie (purpose = 'retrait').
   */
  async verifierCodeRetrait(membreId: number, codeBrut: string): Promise<string> {
    const membre = await this.membreRepo
      .createQueryBuilder('m')
      .addSelect('m.codeRetrait')
      .addSelect('m.tentativesCodeRetraitEchouees')
      .addSelect('m.codeRetraitBloqueJusqua')
      .where('m.id = :id', { id: membreId })
      .getOne();

    if (!membre) throw new NotFoundException('Membre introuvable.');

    if (!membre.codeRetrait) {
      throw new BadRequestException(
        "Vous n'avez pas encore défini de code de retrait. " +
        'Rendez-vous sur /auth/code-retrait pour en créer un.',
      );
    }

    await this.verifierBlocageCodeRetrait(membre);

    const codeOk = await bcrypt.compare(codeBrut, membre.codeRetrait);
    if (!codeOk) {
      await this.incrementerTentativesCodeRetrait(membre);
      throw new UnauthorizedException('Code de retrait incorrect.');
    }

    // Réinitialise le compteur
    await this.membreRepo.update(membreId, {
      tentativesCodeRetraitEchouees: 0,
      codeRetraitBloqueJusqua: null,
    });

    return this.emettrJetonRetrait(membreId);
  }

  /**
   * Méthode interne réutilisable par les futures routes de retrait.
   * Lève une exception si le code est invalide ou si le membre est bloqué.
   */
  async verifierCodeRetraitInterne(membreId: number, codeBrut: string): Promise<void> {
    await this.verifierCodeRetrait(membreId, codeBrut);
  }

  // ─────────────────────────────────────────────
  //  Méthodes privées utilitaires
  // ─────────────────────────────────────────────

  /** Émet un access token + refresh token et persiste le refresh en base. */
  private async emettrePaire(membre: Membre): Promise<TokenPair> {
    const payload: JwtPayload = { sub: membre.id, role: membre.role };

    const accessExpires = this.config.get<string>('jwt.accessExpiresIn') ?? '15m';
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: accessExpires as never,
      audience: 'tontine-access',
    });

    const refreshDays = this.config.get<number>('jwt.refreshExpiresInDays') ?? 30;
    const refreshToken = crypto.randomBytes(48).toString('hex');
    const expireLe = new Date(Date.now() + refreshDays * 24 * 60 * 60 * 1000);

    await this.jetonService.creer(membre.id, refreshToken, expireLe);

    return { accessToken, refreshToken };
  }

  /** Émet un jeton de retrait JWT (courte durée, audience dédiée). */
  private emettrJetonRetrait(membreId: number): string {
    const payload: JwtRetraitPayload = { sub: membreId, purpose: 'retrait' };
    const expires = this.config.get<string>('jwt.retraitExpiresIn') ?? '5m';
    return this.jwtService.sign(payload, {
      expiresIn: expires as never,
      audience: 'tontine-retrait',
    });
  }

  /** Incrémente le compteur de tentatives de connexion et bloque si dépassement. */
  private async incrementerTentativesConnexion(membre: Membre): Promise<void> {
    const max = await this.parametres.getNumber('max_tentatives_connexion').catch(() => 5);
    const dureeMins = await this.parametres
      .getNumber('duree_blocage_connexion_minutes')
      .catch(() => 15);

    const nouvelles = (membre.tentativesConnexionEchouees ?? 0) + 1;
    const bloqueeJusqua =
      nouvelles >= max
        ? new Date(Date.now() + dureeMins * 60 * 1000)
        : null;

    await this.membreRepo.update(membre.id, {
      tentativesConnexionEchouees: nouvelles,
      connexionBloqueeJusqua: bloqueeJusqua,
    });
  }

  /** Vérifie si le membre est bloqué pour le code de retrait. */
  private async verifierBlocageCodeRetrait(membre: Membre): Promise<void> {
    if (membre.codeRetraitBloqueJusqua && membre.codeRetraitBloqueJusqua > new Date()) {
      const restantMs = membre.codeRetraitBloqueJusqua.getTime() - Date.now();
      const restantMin = Math.ceil(restantMs / 60000);
      throw new HttpException(
        `Code de retrait bloqué. Réessayez dans ${restantMin} minute(s).`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  /** Incrémente le compteur de tentatives de code de retrait et bloque si dépassement. */
  private async incrementerTentativesCodeRetrait(membre: Membre): Promise<void> {
    const max = await this.parametres.getNumber('max_tentatives_code_retrait').catch(() => 3);
    const dureeMins = await this.parametres
      .getNumber('duree_blocage_code_retrait_minutes')
      .catch(() => 30);

    const nouvelles = (membre.tentativesCodeRetraitEchouees ?? 0) + 1;
    const bloqueeJusqua =
      nouvelles >= max
        ? new Date(Date.now() + dureeMins * 60 * 1000)
        : null;

    await this.membreRepo.update(membre.id, {
      tentativesCodeRetraitEchouees: nouvelles,
      codeRetraitBloqueJusqua: bloqueeJusqua,
    });
  }
}
