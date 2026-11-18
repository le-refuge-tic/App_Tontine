/**
 * Tests unitaires d'AuthService.
 *
 * Stratégie d'injection : on injecte les mocks en utilisant directement les
 * classes (Membre, Portefeuille) comme tokens, via useValue.
 * On n'importe PAS getRepositoryToken (qui force le chargement de @nestjs/typeorm
 * ESM dans ts-jest CJS). AuthService reçoit ses dépendances via le contaîner
 * NestJS sans que Jest ait besoin de résoudre ce module ESM.
 */

import {
  BadRequestException,
  HttpException,
  HttpStatus,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { JetonRafraichissementService } from '../jeton-rafraichissement/jeton-rafraichissement.service';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { Membre } from '../membre/entities/membre.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { JetonRafraichissement } from '../jeton-rafraichissement/entities/jeton-rafraichissement.entity';
import { Role, StatutMembre } from '../common/enums';

// ─── Tokens TypeORM (injectés sans importer @nestjs/typeorm) ─────────────────
// NestJS génère ses tokens sous la forme `EntityMetadataToken_<EntityName>`.
// Pour les tests unitaires, on peut aussi passer la classe directement.
const MEMBRE_REPO_TOKEN = `${Membre.name}Repository` as const;
const PORTEFEUILLE_REPO_TOKEN = `${Portefeuille.name}Repository` as const;
const JETON_REPO_TOKEN = `${JetonRafraichissement.name}Repository` as const;

// ─── Helpers ─────────────────────────────────────────────────────────────────

const ROUNDS = 4; // Tours réduits pour accélérer les tests

async function fabriqueMembre(
  overrides: Partial<Membre> & { passwordBrut?: string; codeBrut?: string } = {},
): Promise<Membre> {
  const { passwordBrut = 'Password1', codeBrut, ...rest } = overrides;
  const m = Object.assign(new Membre(), {
    id: 1,
    nom: 'Alice',
    phone: '97000000',
    password: await bcrypt.hash(passwordBrut, ROUNDS),
    codeRetrait: codeBrut ? await bcrypt.hash(codeBrut, ROUNDS) : null,
    role: Role.MEMBRE,
    statut: StatutMembre.ACTIF,
    tentativesConnexionEchouees: 0,
    connexionBloqueeJusqua: null,
    tentativesCodeRetraitEchouees: 0,
    codeRetraitBloqueJusqua: null,
    ...rest,
  });
  return m;
}

/** Crée un mock de QueryBuilder retournant le membre fourni. */
function qb(membre: Membre | null) {
  return {
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(membre),
  };
}

// ─── Setup ───────────────────────────────────────────────────────────────────

describe('AuthService', () => {
  let service: AuthService;

  // Mocks bruts (pas de types NestJS dépendant d'ESM)
  const membreRepoMock = {
    findOneBy: jest.fn(),
    update: jest.fn().mockResolvedValue(undefined),
    createQueryBuilder: jest.fn(),
    manager: {
      transaction: jest.fn(),
    },
  };

  const portefeuilleRepoMock = {
    create: jest.fn(),
    save: jest.fn(),
  };

  const jetonRepoMock = {
    findOne: jest.fn(),
  };

  const jetonServiceMock: Partial<JetonRafraichissementService> = {
    hash: jest.fn((s: string) => `${s}_hash`),
    creer: jest.fn().mockResolvedValue(undefined),
    trouverActif: jest.fn(),
    revoquer: jest.fn().mockResolvedValue(undefined),
    revoquerTousPourMembre: jest.fn().mockResolvedValue(undefined),
    purgerExpires: jest.fn().mockResolvedValue(undefined),
  };

  const parametresMock: Partial<ParametreSystemeService> = {
    getNumber: jest.fn().mockImplementation((cle: string) => {
      const valeurs: Record<string, number> = {
        max_tentatives_connexion: 5,
        duree_blocage_connexion_minutes: 15,
        max_tentatives_code_retrait: 3,
        duree_blocage_code_retrait_minutes: 30,
      };
      return Promise.resolve(valeurs[cle] ?? 5);
    }),
  };

  const jwtServiceMock = {
    sign: jest.fn().mockReturnValue('access.token.mock'),
  };

  const configServiceMock = {
    get: jest.fn().mockImplementation((key: string) => {
      const vals: Record<string, string | number> = {
        'bcrypt.rounds': ROUNDS,
        'jwt.accessExpiresIn': '15m',
        'jwt.refreshExpiresInDays': 30,
        'jwt.retraitExpiresIn': '5m',
      };
      return vals[key];
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Réinitialise le mock du manager pour qu'il puisse être configuré par test
    membreRepoMock.manager.transaction.mockImplementation(async (cb: (m: unknown) => unknown) =>
      cb({
        getRepository: jest.fn().mockImplementation((entity: unknown) => {
          if (entity === Membre) return membreRepoMock;
          if (entity === Portefeuille) return portefeuilleRepoMock;
          return {};
        }),
      }),
    );

    portefeuilleRepoMock.create.mockImplementation((v: unknown) => v);
    portefeuilleRepoMock.save.mockImplementation(async (v: unknown) => v);
    membreRepoMock.findOneBy.mockResolvedValue(null);

    // Accès au repo privé via le service (détection de vol)
    // On expose le repo mock directement sur le service après création.
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: MEMBRE_REPO_TOKEN, useValue: membreRepoMock },
        { provide: PORTEFEUILLE_REPO_TOKEN, useValue: portefeuilleRepoMock },
        { provide: JETON_REPO_TOKEN, useValue: jetonRepoMock },
        { provide: JetonRafraichissementService, useValue: jetonServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
        { provide: ConfigService, useValue: configServiceMock },
        { provide: ParametreSystemeService, useValue: parametresMock },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    // Expose le repo pour les tests de détection de vol
    (jetonServiceMock as { repo?: unknown }).repo = jetonRepoMock;
  });

  // ─── seConnecter ─────────────────────────────────────────────────────────

  describe('seConnecter', () => {
    it('renvoie membre + tokens avec les bons identifiants', async () => {
      const membre = await fabriqueMembre({ passwordBrut: 'Password1' });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));
      (membreRepoMock as typeof membreRepoMock & { create?: jest.Mock }).create = jest.fn().mockReturnValue(membre);
      (membreRepoMock as typeof membreRepoMock & { save?: jest.Mock }).save = jest.fn().mockResolvedValue(membre);

      const result = await service.seConnecter({ phone: '97000000', password: 'Password1' });

      expect(result.membre).toBe(membre);
      expect(result.accessToken).toBe('access.token.mock');
      expect(result.refreshToken).toBeTruthy();
      expect(jetonServiceMock.creer).toHaveBeenCalledTimes(1);
      expect(membreRepoMock.update).toHaveBeenCalledWith(
        membre.id,
        expect.objectContaining({ tentativesConnexionEchouees: 0, connexionBloqueeJusqua: null }),
      );
    });

    it('renvoie "Identifiants invalides" si le password est incorrect', async () => {
      const membre = await fabriqueMembre({ passwordBrut: 'CorrectPass1' });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      await expect(
        service.seConnecter({ phone: '97000000', password: 'MauvaisPass1' }),
      ).rejects.toThrow('Identifiants invalides.');
    });

    it('renvoie "Identifiants invalides" si le phone est inconnu (anti-énumération)', async () => {
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(null));

      await expect(
        service.seConnecter({ phone: '99999999', password: 'Password1' }),
      ).rejects.toThrow('Identifiants invalides.');

      // Aucune mise à jour du compteur si le membre est absent
      expect(membreRepoMock.update).not.toHaveBeenCalled();
    });

    it('incrémente le compteur à chaque échec', async () => {
      const membre = await fabriqueMembre({ passwordBrut: 'CorrectPass1', tentativesConnexionEchouees: 2 });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      await expect(
        service.seConnecter({ phone: '97000000', password: 'Mauvais1' }),
      ).rejects.toThrow(UnauthorizedException);

      expect(membreRepoMock.update).toHaveBeenCalledWith(
        membre.id,
        expect.objectContaining({ tentativesConnexionEchouees: 3 }),
      );
    });

    it('bloque après 5 échecs (5ème tentative déclenche le blocage)', async () => {
      const membre = await fabriqueMembre({ passwordBrut: 'CorrectPass1', tentativesConnexionEchouees: 4 });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      await expect(
        service.seConnecter({ phone: '97000000', password: 'Mauvais1' }),
      ).rejects.toThrow(UnauthorizedException);

      const mise_a_jour = membreRepoMock.update.mock.calls[0][1] as Partial<Membre>;
      expect(mise_a_jour.tentativesConnexionEchouees).toBe(5);
      expect(mise_a_jour.connexionBloqueeJusqua).toBeInstanceOf(Date);
      expect((mise_a_jour.connexionBloqueeJusqua as Date).getTime()).toBeGreaterThan(Date.now());
    });

    it('renvoie 429 quand le compte est bloqué, même avec le bon password', async () => {
      const blocage = new Date(Date.now() + 10 * 60 * 1000);
      const membre = await fabriqueMembre({ passwordBrut: 'Password1', connexionBloqueeJusqua: blocage });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      const err = await service.seConnecter({ phone: '97000000', password: 'Password1' }).catch(e => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
      expect((err as HttpException).message).toContain('Réessayez dans');
    });

    it('débloque automatiquement après expiration du blocage', async () => {
      const blocageExpire = new Date(Date.now() - 1000);
      const membre = await fabriqueMembre({ passwordBrut: 'Password1', connexionBloqueeJusqua: blocageExpire });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      const result = await service.seConnecter({ phone: '97000000', password: 'Password1' });

      expect(result.membre).toBe(membre);
      expect(membreRepoMock.update).toHaveBeenCalledWith(
        membre.id,
        expect.objectContaining({ tentativesConnexionEchouees: 0, connexionBloqueeJusqua: null }),
      );
    });
  });

  // ─── rafraichir ──────────────────────────────────────────────────────────

  describe('rafraichir', () => {
    it('émet un nouveau couple et révoque l\'ancien (rotation)', async () => {
      const membre = await fabriqueMembre();
      const jetonActif = Object.assign(new JetonRafraichissement(), {
        membre,
        expireLe: new Date(Date.now() + 1_000_000),
        revoqueLe: null,
      });
      (jetonServiceMock.trouverActif as jest.Mock).mockResolvedValue(jetonActif);

      const result = await service.rafraichir('refresh-token-brut');

      expect(jetonServiceMock.revoquer).toHaveBeenCalledWith('refresh-token-brut');
      expect(jetonServiceMock.creer).toHaveBeenCalledTimes(1);
      expect(result.accessToken).toBe('access.token.mock');
    });

    it('révoque toute la famille si un jeton révoqué est présenté (détection de vol)', async () => {
      (jetonServiceMock.trouverActif as jest.Mock).mockResolvedValue(null);
      const membre = await fabriqueMembre();
      jetonRepoMock.findOne.mockResolvedValue({
        membre,
        hashJeton: 'refresh-token-brut_hash',
        revoqueLe: new Date(),
      });

      await expect(service.rafraichir('refresh-token-brut')).rejects.toThrow(UnauthorizedException);

      expect(jetonServiceMock.revoquerTousPourMembre).toHaveBeenCalledWith(membre.id);
    });

    it('refuse si le jeton est expiré', async () => {
      const membre = await fabriqueMembre();
      const jetonExpire = Object.assign(new JetonRafraichissement(), {
        membre,
        expireLe: new Date(Date.now() - 1000),
        revoqueLe: null,
      });
      (jetonServiceMock.trouverActif as jest.Mock).mockResolvedValue(jetonExpire);

      await expect(service.rafraichir('expired-token')).rejects.toThrow(UnauthorizedException);
      expect(jetonServiceMock.revoquer).toHaveBeenCalledWith('expired-token');
    });
  });

  // ─── definirCodeRetrait ──────────────────────────────────────────────────

  describe('definirCodeRetrait', () => {
    it('refuse un code de retrait identique au password (comparaison brut)', async () => {
      const membre = await fabriqueMembre({ passwordBrut: 'Password1' });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      await expect(
        service.definirCodeRetrait(1, { password: 'Password1', codeRetrait: 'Password1' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepte et enregistre un code différent du password', async () => {
      const membre = await fabriqueMembre({ passwordBrut: 'Password1' });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      await expect(
        service.definirCodeRetrait(1, { password: 'Password1', codeRetrait: '1234' }),
      ).resolves.toBeUndefined();

      expect(membreRepoMock.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ codeRetrait: expect.any(String) }),
      );
    });
  });

  // ─── verifierCodeRetrait ─────────────────────────────────────────────────

  describe('verifierCodeRetrait', () => {
    it('renvoie un jeton de retrait si le code est correct', async () => {
      const membre = await fabriqueMembre({ passwordBrut: 'Password1', codeBrut: '1234' });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      const jeton = await service.verifierCodeRetrait(1, '1234');

      expect(typeof jeton).toBe('string');
      expect(membreRepoMock.update).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ tentativesCodeRetraitEchouees: 0 }),
      );
    });

    it('lève UnauthorizedException si le code est incorrect', async () => {
      const membre = await fabriqueMembre({ passwordBrut: 'Password1', codeBrut: '1234' });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      await expect(service.verifierCodeRetrait(1, '9999')).rejects.toThrow(UnauthorizedException);
    });

    it('lève BadRequestException si aucun code de retrait n\'est défini', async () => {
      const membre = await fabriqueMembre({ passwordBrut: 'Password1' }); // pas de codeBrut
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      await expect(service.verifierCodeRetrait(1, '1234')).rejects.toThrow(BadRequestException);
    });

    it('bloque après 3 échecs consécutifs', async () => {
      const membre = await fabriqueMembre({
        passwordBrut: 'Password1',
        codeBrut: '1234',
        tentativesCodeRetraitEchouees: 2,
      });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      await expect(service.verifierCodeRetrait(1, '9999')).rejects.toThrow(UnauthorizedException);

      const mise_a_jour = membreRepoMock.update.mock.calls[0][1] as Partial<Membre>;
      expect(mise_a_jour.tentativesCodeRetraitEchouees).toBe(3);
      expect(mise_a_jour.codeRetraitBloqueJusqua).toBeInstanceOf(Date);
    });

    it('renvoie 429 quand le code de retrait est bloqué', async () => {
      const membre = await fabriqueMembre({
        passwordBrut: 'Password1',
        codeBrut: '1234',
        codeRetraitBloqueJusqua: new Date(Date.now() + 20 * 60 * 1000),
      });
      membreRepoMock.createQueryBuilder.mockReturnValue(qb(membre));

      const err = await service.verifierCodeRetrait(1, '9999').catch(e => e);

      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    });
  });
});
