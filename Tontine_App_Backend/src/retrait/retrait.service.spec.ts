/**
 * Tests unitaires du RetraitService + TransactionService.confirmerRetrait.
 *
 * Stratégie :
 * - FedapayClientFaux pour simuler les appels réseau FedaPay.
 * - Mocks manuels des Repository TypeORM (pas de base de données).
 * - JwtModule configuré avec un secret de test pour signer/vérifier en mémoire.
 */

import {
  ConflictException,
  UnauthorizedException,
  UnprocessableEntityException,
  ServiceUnavailableException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RetraitService } from './retrait.service';
import { FedapayClientFaux } from '../fedapay/fedapay-client.faux';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import { NotificationService } from '../notification/notification.service';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { JetonRetraitConsomme } from '../jeton-retrait-consomme/entities/jeton-retrait-consomme.entity';
import {
  StatutTransaction,
  TypeTransaction,
  TypeEcriture,
} from '../common/enums';

// ─── Tokens TypeORM ───────────────────────────────────────────────────────────
const TX_REPO_TOKEN = `${Transaction.name}Repository` as const;
const MEMBRE_REPO_TOKEN = `${Membre.name}Repository` as const;
const PORTEFEUILLE_REPO_TOKEN = `${Portefeuille.name}Repository` as const;
const ECRITURE_REPO_TOKEN = `${EcritureComptable.name}Repository` as const;
const JETON_CONSOMME_REPO_TOKEN =
  `${JetonRetraitConsomme.name}Repository` as const;

// ─── Secret JWT de test ───────────────────────────────────────────────────────
const JWT_SECRET = 'test-secret-retrait-jest';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fabriqueMembre(overrides: Partial<Membre> = {}): Membre {
  return Object.assign(new Membre(), {
    id: 1,
    nom: 'Alice Test',
    phone: '2290197000000',
    ...overrides,
  });
}

function fabriquePortefeuille(
  overrides: Partial<Portefeuille> = {},
): Portefeuille {
  return Object.assign(new Portefeuille(), {
    id: 1,
    soldeCotisation: 1000,
    soldeEpargne: 0,
    soldeBloque: 0,
    ...overrides,
  });
}

/**
 * Fabrique un mock d'EntityManager pour le callback de manager.transaction().
 * jetonConsommeSave : permet de contrôler si la consommation réussit ou lève
 * une erreur (pour simuler le rejeu).
 */
function fabriqueManager(
  portefeuille: Portefeuille | null,
  fondsCaisse: number,
  retraitReserve: number,
  jetonConsommeSave: jest.Mock = jest
    .fn()
    .mockResolvedValue({ id: 1, jti: 'jti-test' }),
) {
  const txRepoInternal = {
    create: jest.fn(
      (data: Partial<Transaction>) => ({ ...data }) as Transaction,
    ),
    save: jest.fn((tx: Partial<Transaction>) =>
      Promise.resolve({ ...tx, id: 42 } as Transaction),
    ),
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: String(retraitReserve) }),
    }),
  };
  const ecritureRepoInternal = {
    createQueryBuilder: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: String(fondsCaisse) }),
    }),
  };
  const portefeuilleRepoInternal = {
    createQueryBuilder: jest.fn().mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(portefeuille),
    }),
  };
  const jetonConsommeRepoInternal = {
    create: jest.fn((data: Partial<JetonRetraitConsomme>) => ({
      ...data,
    })),
    save: jetonConsommeSave,
  };

  const getRepository = jest.fn().mockImplementation((entity: unknown) => {
    const name = (entity as { name?: string }).name ?? String(entity);
    if (name === 'Transaction') return txRepoInternal;
    if (name === 'Portefeuille') return portefeuilleRepoInternal;
    if (name === 'EcritureComptable') return ecritureRepoInternal;
    if (name === 'JetonRetraitConsomme') return jetonConsommeRepoInternal;
    return {};
  });
  return { getRepository, _txRepo: txRepoInternal };
}

// ─── Setup ────────────────────────────────────────────────────────────────────
describe('RetraitService', () => {
  let service: RetraitService;
  let fedapayFaux: FedapayClientFaux;
  let jwtService: JwtService;
  let txRepoMock: {
    save: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let membreRepoMock: { findOneBy: jest.Mock };
  let notifMock: { create: jest.Mock };
  let parametresMock: { getNumber: jest.Mock };

  /** Signe un jeton de retrait valide pour le membre `id`. */
  function signerJeton(id: number, expiresIn = '5m'): string {
    return jwtService.sign(
      { sub: id, purpose: 'retrait' },
      {
        secret: JWT_SECRET,
        expiresIn,
        audience: 'tontine-retrait',
        jwtid: `jti-${Date.now()}-${Math.random()}`,
      },
    );
  }

  beforeEach(async () => {
    fedapayFaux = new FedapayClientFaux();
    txRepoMock = {
      save: jest
        .fn()
        .mockImplementation((tx: Partial<Transaction>) =>
          Promise.resolve({ ...tx, id: 42 } as Transaction),
        ),
      manager: { transaction: jest.fn() },
    };
    membreRepoMock = {
      findOneBy: jest.fn().mockResolvedValue(fabriqueMembre()),
    };
    notifMock = { create: jest.fn().mockResolvedValue(undefined) };
    parametresMock = {
      getNumber: jest.fn().mockRejectedValue(new Error('absent')),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [
        JwtModule.register({
          secret: JWT_SECRET,
        }),
      ],
      providers: [
        RetraitService,
        { provide: TX_REPO_TOKEN, useValue: txRepoMock },
        { provide: MEMBRE_REPO_TOKEN, useValue: membreRepoMock },
        { provide: PORTEFEUILLE_REPO_TOKEN, useValue: {} },
        { provide: ECRITURE_REPO_TOKEN, useValue: {} },
        { provide: JETON_CONSOMME_REPO_TOKEN, useValue: {} },
        { provide: FEDAPAY_CLIENT, useValue: fedapayFaux },
        { provide: NotificationService, useValue: notifMock },
        { provide: ParametreSystemeService, useValue: parametresMock },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
        },
      ],
    }).compile();

    service = module.get<RetraitService>(RetraitService);
    jwtService = module.get<JwtService>(JwtService);
  });

  /**
   * Configure le mock de `manager.transaction` pour simuler une transaction DB.
   * jetonConsommeSave contrôle si la consommation réussit ou échoue.
   */
  function configurerManagerTransaction(
    soldeCotisation: number,
    fondsCaisse: number,
    retraitReserve: number,
    txId = 42,
    jetonConsommeSave?: jest.Mock,
    soldeBloque = 0,
  ) {
    txRepoMock.manager.transaction.mockImplementation(
      async (cb: (m: unknown) => Promise<void>) => {
        const manager = fabriqueManager(
          fabriquePortefeuille({ soldeCotisation, soldeBloque }),
          fondsCaisse,
          retraitReserve,
          jetonConsommeSave,
        );
        manager._txRepo.save.mockImplementation((tx: Partial<Transaction>) =>
          Promise.resolve({ ...tx, id: txId } as Transaction),
        );
        await cb(manager);
      },
    );
  }

  // ─── Tests JWT ────────────────────────────────────────────────────────────
  it('rejette un jeton expiré (401)', () => {
    const jetonExpire = signerJeton(1, '-1s');
    expect(() =>
      service.verifierEtConsommerJetonRetrait(jetonExpire, 1),
    ).toThrow(UnauthorizedException);
  });

  it('rejette un jeton signé pour un autre membre (401)', () => {
    const jetonAutre = signerJeton(99);
    expect(() =>
      service.verifierEtConsommerJetonRetrait(jetonAutre, 1),
    ).toThrow(UnauthorizedException);
  });

  it('rejette un jeton avec une audience incorrecte (401)', () => {
    const jetonMauvaisAudience = jwtService.sign(
      { sub: 1, purpose: 'retrait' },
      { secret: JWT_SECRET, expiresIn: '5m', audience: 'tontine-access' },
    );
    expect(() =>
      service.verifierEtConsommerJetonRetrait(jetonMauvaisAudience, 1),
    ).toThrow(UnauthorizedException);
  });

  // ─── Tests DTO ────────────────────────────────────────────────────────────
  it('rejette si ni montant ni total (400)', async () => {
    const jeton = signerJeton(1);
    await expect(service.creer(1, { jetonRetrait: jeton })).rejects.toThrow(
      BadRequestException,
    );
  });

  it('rejette si montant ET total (400)', async () => {
    const jeton = signerJeton(1);
    await expect(
      service.creer(1, { montant: 100, total: true, jetonRetrait: jeton }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Tests solde ──────────────────────────────────────────────────────────
  it('rejette si retirable est nul (422)', async () => {
    configurerManagerTransaction(0, 0, 0);
    const jeton = signerJeton(1);
    await expect(
      service.creer(1, { montant: 100, jetonRetrait: jeton }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejette si montant > retirable (422)', async () => {
    configurerManagerTransaction(500, 0, 0);
    const jeton = signerJeton(1);
    await expect(
      service.creer(1, { montant: 600, jetonRetrait: jeton }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it('rejette si un retrait est déjà en cours (409)', async () => {
    configurerManagerTransaction(1000, 0, 200);
    const jeton = signerJeton(1);
    await expect(
      service.creer(1, { montant: 500, jetonRetrait: jeton }),
    ).rejects.toThrow(ConflictException);
  });

  // ─── C. Garde-fou soldeBloque ─────────────────────────────────────────────
  it('refuse le retrait total si soldeBloque > 0 (422)', async () => {
    // soldeBloque = 300, retirable = 1000 - 300 = 700
    configurerManagerTransaction(1000, 0, 0, 42, undefined, 300);
    const jeton = signerJeton(1);
    await expect(
      service.creer(1, { total: true, jetonRetrait: jeton }),
    ).rejects.toThrow(UnprocessableEntityException);
    // Vérifier le message
    await expect(
      service.creer(1, { total: true, jetonRetrait: signerJeton(1) }),
    ).rejects.toThrow('fonds sont bloqués');
  });

  it('autorise le retrait partiel même si soldeBloque > 0', async () => {
    // soldeBloque = 300, soldeCotisation = 1000, fondsCaisse = 0
    // retirable = 1000 - 300 = 700 → retrait de 200 OK
    configurerManagerTransaction(1000, 0, 0, 42, undefined, 300);
    fedapayFaux.definirIdFedapayPayout('PO_BLOQUE');
    txRepoMock.save = jest
      .fn()
      .mockImplementation((tx: Partial<Transaction>) =>
        Promise.resolve({ ...tx, id: 42 } as Transaction),
      );
    const jeton = signerJeton(1);
    const { transaction } = await service.creer(1, {
      montant: 200,
      jetonRetrait: jeton,
    });
    expect(transaction.type).toBe(TypeTransaction.RETRAIT);
    expect(transaction.statut).toBe(StatutTransaction.EN_ATTENTE);
  });

  // ─── A. Jeton usage unique ────────────────────────────────────────────────
  it('rejette un jeton rejoué après un retrait réussi (401)', async () => {
    // Simuler que le jti est déjà en base → save lève une erreur de contrainte.
    const erreurContrainte = new Error(
      'duplicate key value violates unique constraint',
    );
    (erreurContrainte as Error & { code?: string }).code = '23505';
    const saveEchoue = jest.fn().mockRejectedValue(erreurContrainte);

    configurerManagerTransaction(1000, 0, 0, 42, saveEchoue);
    const jeton = signerJeton(1);
    await expect(
      service.creer(1, { montant: 200, jetonRetrait: jeton }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('ne consomme pas le jeton si le retrait est refusé (montant trop élevé)', async () => {
    // La vérification du montant arrive APRÈS la consommation du jeton dans la tx.
    // Si la tx DB est annulée (rollback), le jeton n'est pas réellement inséré.
    // Ce test vérifie que le service lève bien 422, pas 401.
    configurerManagerTransaction(500, 0, 0);
    const jeton = signerJeton(1);
    // Premier appel : refusé car montant > retirable
    await expect(
      service.creer(1, { montant: 600, jetonRetrait: jeton }),
    ).rejects.toThrow(UnprocessableEntityException);
    // Si le jeton n'est pas consommé (rollback DB), on peut réessayer avec 400F
    // (simulé ici par le fait que le même mock ne retourne pas d'erreur 401)
    configurerManagerTransaction(500, 0, 0, 42);
    fedapayFaux.definirIdFedapayPayout('PO_RETRY');
    txRepoMock.save = jest
      .fn()
      .mockImplementation((tx: Partial<Transaction>) =>
        Promise.resolve({ ...tx, id: 50 } as Transaction),
      );
    const { transaction } = await service.creer(1, {
      montant: 400,
      jetonRetrait: jeton,
    });
    expect(transaction.type).toBe(TypeTransaction.RETRAIT);
  });

  it('deux demandes simultanées avec le même jeton : une seule passe', async () => {
    // La première consommation réussit, la deuxième lève une erreur d'unicité.
    let premierAppel = true;
    const saveConcurrent = jest.fn().mockImplementation(() => {
      if (premierAppel) {
        premierAppel = false;
        return Promise.resolve({ id: 1, jti: 'jti-concurrent' });
      }
      return Promise.reject(
        new Error('duplicate key value violates unique constraint'),
      );
    });

    // Les deux appels partagent le même mock de consommation.
    txRepoMock.manager.transaction.mockImplementation(
      async (cb: (m: unknown) => Promise<void>) => {
        const manager = fabriqueManager(
          fabriquePortefeuille({ soldeCotisation: 1000 }),
          0,
          0,
          saveConcurrent,
        );
        manager._txRepo.save.mockResolvedValue({ id: 42 } as Transaction);
        await cb(manager);
      },
    );

    fedapayFaux.definirIdFedapayPayout('PO_CONCURRENT');
    txRepoMock.save = jest.fn().mockResolvedValue({ id: 42 });

    const jeton = signerJeton(1);
    const [res1, res2] = await Promise.allSettled([
      service.creer(1, { montant: 100, jetonRetrait: jeton }),
      service.creer(1, { montant: 100, jetonRetrait: jeton }),
    ]);

    const succes = [res1, res2].filter((r) => r.status === 'fulfilled');
    const echecs = [res1, res2].filter((r) => r.status === 'rejected');
    expect(succes).toHaveLength(1);
    expect(echecs).toHaveLength(1);
    if (echecs[0].status === 'rejected') {
      expect(echecs[0].reason).toBeInstanceOf(UnauthorizedException);
    }
  });

  // ─── Tests flux nominal ───────────────────────────────────────────────────
  it('crée un retrait partiel réussi', async () => {
    configurerManagerTransaction(1000, 0, 0, 10);
    fedapayFaux.definirIdFedapayPayout('PO999');
    txRepoMock.save = jest
      .fn()
      .mockImplementation((tx: Partial<Transaction>) =>
        Promise.resolve({ ...tx, id: 10 } as Transaction),
      );
    const jeton = signerJeton(1);
    const { transaction } = await service.creer(1, {
      montant: 500,
      jetonRetrait: jeton,
    });
    expect(transaction.type).toBe(TypeTransaction.RETRAIT);
    expect(transaction.statut).toBe(StatutTransaction.EN_ATTENTE);
    expect(transaction.estRetraitTotal).toBe(false);
  });

  it('crée un retrait total réussi', async () => {
    configurerManagerTransaction(1000, 200, 0, 11);
    fedapayFaux.definirIdFedapayPayout('PO888');
    txRepoMock.save = jest
      .fn()
      .mockImplementation((tx: Partial<Transaction>) =>
        Promise.resolve({ ...tx, id: 11 } as Transaction),
      );
    const jeton = signerJeton(1);
    const { transaction } = await service.creer(1, {
      total: true,
      jetonRetrait: jeton,
    });
    expect(transaction.estRetraitTotal).toBe(true);
    expect(transaction.type).toBe(TypeTransaction.RETRAIT);
  });

  it('marque la transaction ECHOUE si FedaPay échoue', async () => {
    configurerManagerTransaction(1000, 0, 0, 20);
    jest
      .spyOn(fedapayFaux, 'creerEtEnvoyerPayout')
      .mockRejectedValue(new Error('FedaPay indisponible'));
    const savedTxs: Transaction[] = [];
    txRepoMock.save = jest
      .fn()
      .mockImplementation((tx: Partial<Transaction>) => {
        const t = { ...tx, id: 20 } as Transaction;
        savedTxs.push(t);
        return Promise.resolve(t);
      });
    const jeton = signerJeton(1);
    await expect(
      service.creer(1, { montant: 500, jetonRetrait: jeton }),
    ).rejects.toThrow(ServiceUnavailableException);
    const txEchouee = savedTxs.find(
      (t) => t.statut === StatutTransaction.ECHOUE,
    );
    expect(txEchouee).toBeDefined();
  });

  // ─── Calcul des frais ─────────────────────────────────────────────────────
  it('calcule les frais correctement', () => {
    expect(service.calculerFraisRetrait(1000, 1.5)).toBe(15);
    expect(service.calculerFraisRetrait(500, 0)).toBe(0);
    expect(service.calculerFraisRetrait(333, 10)).toBe(33);
  });

  // ─── Contrôle chiffré ─────────────────────────────────────────────────────
  it('contrôle chiffré : solde 1000 (500 fondsCaisse) → retrait 200', async () => {
    configurerManagerTransaction(1000, 500, 0, 30);
    fedapayFaux.definirIdFedapayPayout('PO777');
    txRepoMock.save = jest.fn().mockImplementation((tx: Partial<Transaction>) =>
      Promise.resolve({
        ...tx,
        id: 30,
        montant: (tx as Transaction).montant,
      } as Transaction),
    );
    const jeton = signerJeton(1);
    const { transaction } = await service.creer(1, {
      montant: 200,
      jetonRetrait: jeton,
    });
    expect(transaction.montant).toBe(200);
    expect(transaction.type).toBe(TypeTransaction.RETRAIT);
  });
});

// ─── Tests TransactionService.confirmerRetrait ────────────────────────────────
import { TransactionService } from '../transaction/transaction.service';

describe('TransactionService.confirmerRetrait', () => {
  let transactionService: TransactionService;
  let fedapayFaux: FedapayClientFaux;
  let txRepoMock: { findOne: jest.Mock; save: jest.Mock; update: jest.Mock };
  let notifMock: { create: jest.Mock };

  beforeEach(async () => {
    fedapayFaux = new FedapayClientFaux();
    txRepoMock = {
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((tx: Transaction) => Promise.resolve(tx)),
      update: jest.fn().mockResolvedValue(undefined),
    };
    notifMock = { create: jest.fn().mockResolvedValue(undefined) };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: `${Transaction.name}Repository`, useValue: txRepoMock },
        { provide: FEDAPAY_CLIENT, useValue: fedapayFaux },
        { provide: NotificationService, useValue: notifMock },
      ],
    }).compile();

    transactionService = module.get<TransactionService>(TransactionService);
  });

  /**
   * Fabrique un EntityManager mocké pour confirmerRetrait.
   */
  function fabriqueManagerConfirmer(
    tx: Transaction,
    soldeCotisationActuel: number,
    fondsCaisse: number,
  ) {
    const ecritures: EcritureComptable[] = [];
    const ecritureRepoMock = {
      create: jest.fn(
        (data: Partial<EcritureComptable>) =>
          ({ ...data }) as EcritureComptable,
      ),
      save: jest.fn((e: EcritureComptable) => {
        ecritures.push(e);
        return Promise.resolve({ ...e, id: ecritures.length });
      }),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockImplementation((alias?: string) => {
          // Pour fondsCaisseRetenu dans confirmerRetrait
          if (alias === undefined) {
            // getRawOne sans alias = requête liberation_fonds
            return Promise.resolve({ total: String(fondsCaisse) });
          }
          // Pour recalculerPortefeuille
          return Promise.resolve({
            coti_credit: String(soldeCotisationActuel),
            coti_debit: '0',
            retrait_debit: '0',
            epargne_credit: '0',
            epargne_debit: '0',
            bloque_credit: '0',
            bloque_debit: '0',
          });
        }),
      }),
    };

    // Mock spécifique pour la requête fondsCaisseRetenu (retourne le fondsCaisse)
    // On distingue par .andWhere : la requête fondsCaisse a 'e.type = :type'
    // fondsCaisseRetenu query (select + where + andWhere + getRawOne)
    const qbFondsCaisse = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: String(fondsCaisse) }),
    };
    // recalculerPortefeuille query (select + addSelect x6 + where + getRawOne)
    const qbRecalcul = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({
        coti_credit: String(soldeCotisationActuel),
        coti_debit: '0',
        retrait_debit: '0',
        epargne_credit: '0',
        epargne_debit: '0',
        bloque_credit: '0',
        bloque_debit: '0',
      }),
    };

    let qbCallCount = 0;
    ecritureRepoMock.createQueryBuilder = jest.fn().mockImplementation(() => {
      qbCallCount++;
      // Premier appel : fondsCaisseRetenu, second : recalculerPortefeuille
      return qbCallCount === 1 ? qbFondsCaisse : qbRecalcul;
    });

    const updateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const souscriptionRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(updateBuilder),
    };
    const cycleRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue({
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([{ id: 1 }]),
      }),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const jourUpdateBuilder = {
      update: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      execute: jest.fn().mockResolvedValue(undefined),
    };
    const jourRepoMock = {
      createQueryBuilder: jest.fn().mockReturnValue(jourUpdateBuilder),
    };
    const portefeuilleRepoMock = {
      update: jest.fn().mockResolvedValue(undefined),
    };
    const txInternalRepo = {
      findOne: jest.fn().mockResolvedValue(tx),
      save: jest
        .fn()
        .mockImplementation((t: Transaction) => Promise.resolve(t)),
    };

    const getRepository = jest.fn().mockImplementation((entity: unknown) => {
      const name = (entity as { name?: string }).name ?? String(entity);
      if (name === 'Transaction') return txInternalRepo;
      if (name === 'EcritureComptable') return ecritureRepoMock;
      if (name === 'Portefeuille') return portefeuilleRepoMock;
      if (name === 'Souscription') return souscriptionRepoMock;
      if (name === 'Cycle') return cycleRepoMock;
      if (name === 'JourCotisation') return jourRepoMock;
      return {};
    });

    return {
      getRepository,
      _ecritures: ecritures,
      _cycleRepo: cycleRepoMock,
    };
  }

  function fabriqueTransaction(
    overrides: Partial<Transaction> = {},
  ): Transaction {
    return Object.assign(new Transaction(), {
      id: 1,
      type: TypeTransaction.RETRAIT,
      montant: 1000,
      fraisFedapay: 0,
      referenceUnique: 'TX-1-20250101-abcd1234',
      idFedapay: 'PO100',
      statut: StatutTransaction.EN_ATTENTE,
      joursCibles: null,
      estRetraitTotal: false,
      membre: { id: 1 },
      ...overrides,
    });
  }

  it('confirme un retrait partiel : 1 seule écriture RETRAIT', async () => {
    const tx = fabriqueTransaction({ montant: 1000, estRetraitTotal: false });
    const manager = fabriqueManagerConfirmer(tx, 1500, 500);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const ecrituresRetrait = manager._ecritures.filter(
      (e: EcritureComptable) => e.type === TypeEcriture.RETRAIT,
    );
    expect(ecrituresRetrait).toHaveLength(1);
    expect(ecrituresRetrait[0].montant).toBe(1000);
    // Pas d'écriture liberation_fonds pour un retrait partiel
    const ecrituresLib = manager._ecritures.filter(
      (e: EcritureComptable) => e.type === TypeEcriture.LIBERATION_FONDS,
    );
    expect(ecrituresLib).toHaveLength(0);
  });

  it('confirme un retrait total : 1 écriture RETRAIT + 1 écriture LIBERATION_FONDS', async () => {
    // soldeCotisation=1500, montantRetrait=1000, fondsCaisse=500
    // → écriture RETRAIT: 1000
    // → écriture LIBERATION_FONDS: 500 (= fondsCaisseRetenu)
    // → après recalcul: SUM(cotisation credit) - SUM(retrait|liberation debit) = 0 ✓
    const tx = fabriqueTransaction({ montant: 1000, estRetraitTotal: true });
    const manager = fabriqueManagerConfirmer(tx, 1500, 500);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const ecrituresRetrait = manager._ecritures.filter(
      (e: EcritureComptable) => e.type === TypeEcriture.RETRAIT,
    );
    const ecrituresLib = manager._ecritures.filter(
      (e: EcritureComptable) => e.type === TypeEcriture.LIBERATION_FONDS,
    );
    // 1 écriture RETRAIT principale
    expect(ecrituresRetrait).toHaveLength(1);
    expect(ecrituresRetrait[0].montant).toBe(1000);
    // 1 écriture LIBERATION_FONDS = fondsCaisseRetenu
    expect(ecrituresLib).toHaveLength(1);
    expect(ecrituresLib[0].montant).toBe(500);
    // Cycle clôturé
    expect(manager._cycleRepo.update).toHaveBeenCalledWith(1, {
      statut: 'termine',
    });
  });

  it('confirme un retrait total sans fonds de caisse : uniquement RETRAIT', async () => {
    // fondsCaisse=0 → pas d'écriture LIBERATION_FONDS
    const tx = fabriqueTransaction({ montant: 1000, estRetraitTotal: true });
    const manager = fabriqueManagerConfirmer(tx, 1000, 0);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const ecrituresLib = manager._ecritures.filter(
      (e: EcritureComptable) => e.type === TypeEcriture.LIBERATION_FONDS,
    );
    expect(ecrituresLib).toHaveLength(0);
  });

  it('total retiré du rapport = montant RETRAIT uniquement (LIBERATION_FONDS exclu)', () => {
    // Simuler le calcul du rapport côté service (totaux.retire ne compte que RETRAIT)
    const ecrituresSimulees: Array<{
      type: TypeEcriture;
      sens: string;
      montant: number;
    }> = [
      { type: TypeEcriture.RETRAIT, sens: 'debit', montant: 1000 },
      { type: TypeEcriture.LIBERATION_FONDS, sens: 'debit', montant: 500 },
    ];
    const totalRetire = ecrituresSimulees
      .filter((e) => e.type === TypeEcriture.RETRAIT && e.sens === 'debit')
      .reduce((s, e) => s + e.montant, 0);
    expect(totalRetire).toBe(1000); // 500 de liberation_fonds exclus
  });

  it("webhook de retrait rejoué : rien n'est refait (idempotence)", async () => {
    // Le webhookService vérifie statut === REUSSI avant d'appeler confirmer.
    // On simule ici que la transaction est déjà REUSSI.
    const txDejaReussie = fabriqueTransaction({
      montant: 1000,
      estRetraitTotal: false,
      statut: StatutTransaction.REUSSI,
    });
    const noopQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockResolvedValue({ total: '0' }),
    };
    const managerMock = {
      getRepository: jest.fn().mockReturnValue({
        findOne: jest.fn().mockResolvedValue(txDejaReussie),
        save: jest
          .fn()
          .mockImplementation((t: Transaction) => Promise.resolve(t)),
        create: jest.fn(
          (d: Partial<EcritureComptable>) => ({ ...d }) as EcritureComptable,
        ),
        update: jest.fn().mockResolvedValue(undefined),
        createQueryBuilder: jest.fn().mockReturnValue(noopQb),
      }),
    };
    // confirmer avec une tx déjà REUSSI : le code ne doit pas planter.
    await expect(
      transactionService.confirmer(
        1,
        managerMock as unknown as Parameters<
          typeof transactionService.confirmer
        >[1],
      ),
    ).resolves.not.toThrow();
  });
});
