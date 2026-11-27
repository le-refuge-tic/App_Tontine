/**
 * Tests unitaires des retraits d'épargne : RetraitEpargneService.creer() et
 * TransactionService.confirmerRetraitEpargne().
 *
 * Depuis le prompt 7b :
 * - Le taux dépend de l'objectif, pas de la date.
 * - Les tests basés sur la date (bascule à 23h30, Africa/Porto-Novo) sont
 *   retirés (2 tests supprimés).
 * - Nouveaux tests : objectif atteint → 2,75 % ; objectif acquis (objectifAtteintLe
 *   non null) → 2,75 % même si montant retombé sous l'objectif après retrait partiel.
 *
 * Stratégie :
 * - FedapayClientFaux (aucun appel réseau).
 * - Mocks manuels des Repository TypeORM.
 * - JwtModule configuré avec un secret de test.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { RetraitEpargneService } from './retrait-epargne.service';
import { TransactionService } from '../transaction/transaction.service';
import { FedapayClientFaux } from '../fedapay/fedapay-client.faux';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import { NotificationService } from '../notification/notification.service';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { RetraitEpargne } from './entities/retrait-epargne.entity';
import { Epargne } from '../epargne/entities/epargne.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import { JetonRetraitConsomme } from '../jeton-retrait-consomme/entities/jeton-retrait-consomme.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { CaisseApplication } from '../caisse-application/entities/caisse-application.entity';
import {
  SensEcriture,
  SourceCaisse,
  StatutEpargne,
  StatutTransaction,
  TypeEcriture,
  TypeTransaction,
} from '../common/enums';

// ─── Tokens TypeORM ───────────────────────────────────────────────────────────
const RETRAIT_REPO = `${RetraitEpargne.name}Repository`;
const EPARGNE_REPO = `${Epargne.name}Repository`;
const TX_REPO = `${Transaction.name}Repository`;
const MEMBRE_REPO = `${Membre.name}Repository`;
const JETON_REPO = `${JetonRetraitConsomme.name}Repository`;

const JWT_SECRET = 'test-secret-epargne-jest';

// ─── Helpers ─────────────────────────────────────────────────────────────────
function fabriqueMembre(overrides: Partial<Membre> = {}): Membre {
  return Object.assign(new Membre(), {
    id: 1,
    nom: 'Alice Test',
    phone: '2290197000000',
    ...overrides,
  });
}

function fabriqueEpargne(overrides: Partial<Epargne> = {}): Epargne {
  return Object.assign(new Epargne(), {
    id: 1,
    montant: 10000,
    dateEcheance: null,
    statut: StatutEpargne.ACTIVE,
    objectifMontant: 20000, // objectif non atteint par défaut (10000 < 20000)
    objectifAtteintLe: null,
    membre: fabriqueMembre(),
    ...overrides,
  });
}

/**
 * Fabrique un mock d'EntityManager pour le callback de manager.transaction().
 */
function fabriqueManager(
  epargne: Epargne | null,
  pendingCount = 0,
  jetonSave: jest.Mock = jest.fn().mockResolvedValue({ id: 1, jti: 'jti' }),
) {
  const txRepoInternal = {
    create: jest.fn((d: Partial<Transaction>) => ({ ...d }) as Transaction),
    save: jest.fn((tx: Partial<Transaction>) =>
      Promise.resolve({ ...tx, id: 42 } as Transaction),
    ),
    createQueryBuilder: jest.fn().mockReturnValue({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(pendingCount),
    }),
  };
  const epargneRepoInternal = {
    createQueryBuilder: jest.fn().mockReturnValue({
      setLock: jest.fn().mockReturnThis(),
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(epargne),
    }),
  };
  const retraitRepoInternal = {
    create: jest.fn(
      (d: Partial<RetraitEpargne>) => ({ ...d }) as RetraitEpargne,
    ),
    save: jest.fn((r: Partial<RetraitEpargne>) =>
      Promise.resolve({ ...r, id: 1 } as RetraitEpargne),
    ),
  };
  const jetonRepoInternal = {
    create: jest.fn((d: Partial<JetonRetraitConsomme>) => ({ ...d })),
    save: jetonSave,
  };
  const getRepository = jest.fn().mockImplementation((entity: unknown) => {
    const name = (entity as { name?: string }).name ?? String(entity);
    if (name === 'Transaction') return txRepoInternal;
    if (name === 'Epargne') return epargneRepoInternal;
    if (name === 'RetraitEpargne') return retraitRepoInternal;
    if (name === 'JetonRetraitConsomme') return jetonRepoInternal;
    return {};
  });
  return { getRepository };
}

// ─── RetraitEpargneService ───────────────────────────────────────────────────
describe('RetraitEpargneService', () => {
  let service: RetraitEpargneService;
  let fedapayFaux: FedapayClientFaux;
  let jwtService: JwtService;
  let txRepoMock: { save: jest.Mock; manager: { transaction: jest.Mock } };
  let membreRepoMock: { findOneBy: jest.Mock };
  let parametresMock: { getNumber: jest.Mock };

  function signerJeton(id: number, expiresIn = '5m'): string {
    return jwtService.sign(
      { sub: id, purpose: 'retrait' },
      {
        secret: JWT_SECRET,
        expiresIn: expiresIn as Parameters<typeof jwtService.sign>[1] extends {
          expiresIn?: infer E;
        }
          ? E
          : never,
        audience: 'tontine-retrait',
        jwtid: `jti-${Date.now()}-${Math.random()}`,
      },
    );
  }

  function configurerTransaction(
    epargne: Epargne | null,
    pendingCount = 0,
    jetonSave?: jest.Mock,
    txId = 42,
  ) {
    txRepoMock.manager.transaction.mockImplementation(
      async (cb: (m: unknown) => Promise<void>) => {
        const manager = fabriqueManager(epargne, pendingCount, jetonSave);
        manager.getRepository('Transaction' as never).save = jest.fn(
          (tx: Partial<Transaction>) =>
            Promise.resolve({ ...tx, id: txId } as Transaction),
        );
        await cb(manager);
      },
    );
  }

  beforeEach(async () => {
    fedapayFaux = new FedapayClientFaux();
    fedapayFaux.definirIdFedapayPayout('PO-EPARGNE-1');
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
    parametresMock = {
      getNumber: jest.fn().mockImplementation((cle: string) => {
        const vals: Record<string, number> = {
          penalite_epargne_anticipee: 5,
          retenue_epargne_echeance: 2.75,
          pourcentage_frais_retrait: 0,
        };
        return Promise.resolve(vals[cle] ?? 0);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [JwtModule.register({ secret: JWT_SECRET })],
      providers: [
        RetraitEpargneService,
        { provide: RETRAIT_REPO, useValue: {} },
        { provide: EPARGNE_REPO, useValue: {} },
        { provide: TX_REPO, useValue: txRepoMock },
        { provide: MEMBRE_REPO, useValue: membreRepoMock },
        { provide: JETON_REPO, useValue: {} },
        { provide: FEDAPAY_CLIENT, useValue: fedapayFaux },
        { provide: NotificationService, useValue: { create: jest.fn() } },
        { provide: ParametreSystemeService, useValue: parametresMock },
      ],
    }).compile();

    service = module.get<RetraitEpargneService>(RetraitEpargneService);
    jwtService = module.get<JwtService>(JwtService);
  });

  // ─── Validation DTO ──────────────────────────────────────────────────────
  it('rejette si ni montant ni total (400)', async () => {
    configurerTransaction(fabriqueEpargne());
    await expect(
      service.creer(1, 1, { jetonRetrait: signerJeton(1) }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejette si montant ET total (400)', async () => {
    configurerTransaction(fabriqueEpargne());
    await expect(
      service.creer(1, 1, {
        montant: 100,
        total: true,
        jetonRetrait: signerJeton(1),
      }),
    ).rejects.toThrow(BadRequestException);
  });

  // ─── Jeton ───────────────────────────────────────────────────────────────
  it('rejette un jeton expiré (401)', async () => {
    configurerTransaction(fabriqueEpargne());
    const jeton = signerJeton(1, '-1s');
    await expect(
      service.creer(1, 1, { montant: 100, jetonRetrait: jeton }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it("rejette un jeton d'un autre membre (401)", async () => {
    configurerTransaction(fabriqueEpargne());
    const jeton = signerJeton(99);
    await expect(
      service.creer(1, 1, { montant: 100, jetonRetrait: jeton }),
    ).rejects.toThrow(UnauthorizedException);
  });

  it('rejette un jeton rejoué (401)', async () => {
    const erreurContrainte = new Error('duplicate key');
    (erreurContrainte as Error & { code?: string }).code = '23505';
    const saveEchoue = jest.fn().mockRejectedValue(erreurContrainte);
    configurerTransaction(fabriqueEpargne(), 0, saveEchoue);
    const jeton = signerJeton(1);
    await expect(
      service.creer(1, 1, { montant: 100, jetonRetrait: jeton }),
    ).rejects.toThrow(UnauthorizedException);
  });

  // ─── Appartenance / statut ────────────────────────────────────────────────
  it("rejette si l'épargne n'appartient pas au membre (404)", async () => {
    const autreEpargne = fabriqueEpargne({ membre: fabriqueMembre({ id: 2 }) });
    configurerTransaction(autreEpargne);
    await expect(
      service.creer(1, 1, { montant: 100, jetonRetrait: signerJeton(1) }),
    ).rejects.toThrow(NotFoundException);
  });

  it("rejette si l'épargne est introuvable (404)", async () => {
    configurerTransaction(null);
    await expect(
      service.creer(1, 1, { montant: 100, jetonRetrait: signerJeton(1) }),
    ).rejects.toThrow(NotFoundException);
  });

  it("rejette si l'épargne n'est plus active (422)", async () => {
    configurerTransaction(fabriqueEpargne({ statut: StatutEpargne.RETIREE }));
    await expect(
      service.creer(1, 1, { montant: 100, jetonRetrait: signerJeton(1) }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  // ─── Montant ─────────────────────────────────────────────────────────────
  it("rejette si montant > solde de l'épargne (422)", async () => {
    configurerTransaction(fabriqueEpargne({ montant: 500 }));
    await expect(
      service.creer(1, 1, { montant: 600, jetonRetrait: signerJeton(1) }),
    ).rejects.toThrow(UnprocessableEntityException);
  });

  it("rejette si un retrait d'épargne est déjà en attente (409)", async () => {
    configurerTransaction(fabriqueEpargne(), 1);
    await expect(
      service.creer(1, 1, { montant: 100, jetonRetrait: signerJeton(1) }),
    ).rejects.toThrow(ConflictException);
  });

  // ─── Calcul du taux selon l'objectif ──────────────────────────────────────

  it('objectif NON atteint (montant < objectifMontant) : taux 5 %, net 9500 sur 10 000', async () => {
    // montant 10000, objectif 20000 → objectif non atteint → pénalité 5 %.
    const epargne = fabriqueEpargne({
      montant: 10000,
      objectifMontant: 20000,
      objectifAtteintLe: null,
    });
    configurerTransaction(epargne, 0, undefined, 10);
    txRepoMock.save = jest
      .fn()
      .mockImplementation((tx: Partial<Transaction>) =>
        Promise.resolve({ ...tx, id: 10 } as Transaction),
      );
    const { transaction } = await service.creer(1, 1, {
      montant: 10000,
      jetonRetrait: signerJeton(1),
    });
    // net = 10000 - 500 (5%) - 0 (frais) = 9500
    expect(transaction.montant).toBe(9500);
    expect(transaction.type).toBe(TypeTransaction.RETRAIT);
    expect(transaction.statut).toBe(StatutTransaction.EN_ATTENTE);
    expect(transaction.epargne).toMatchObject({ id: 1 });
  });

  it('objectif ATTEINT (montant = objectifMontant) : taux 2,75 %, net 9725 sur 10 000', async () => {
    // objectifAtteintLe null mais montant >= objectif → atteint.
    const epargne = fabriqueEpargne({
      montant: 10000,
      objectifMontant: 10000,
      objectifAtteintLe: null,
    });
    configurerTransaction(epargne, 0, undefined, 11);
    txRepoMock.save = jest
      .fn()
      .mockImplementation((tx: Partial<Transaction>) =>
        Promise.resolve({ ...tx, id: 11 } as Transaction),
      );
    const { transaction } = await service.creer(1, 1, {
      montant: 10000,
      jetonRetrait: signerJeton(1),
    });
    // net = 10000 - 275 (2.75%) - 0 = 9725
    expect(transaction.montant).toBe(9725);
  });

  it("objectif ACQUIS (objectifAtteintLe non null) : taux 2,75 % même si montant retombé sous l'objectif", async () => {
    // Après un retrait partiel, montant 3000 < objectif 10000, mais
    // objectifAtteintLe est renseigné → taux 2,75 %.
    const epargne = fabriqueEpargne({
      montant: 10000,
      objectifMontant: 20000,
      objectifAtteintLe: new Date('2026-01-01T12:00:00Z'),
    });
    configurerTransaction(epargne, 0, undefined, 12);
    txRepoMock.save = jest
      .fn()
      .mockImplementation((tx: Partial<Transaction>) =>
        Promise.resolve({ ...tx, id: 12 } as Transaction),
      );
    const { transaction } = await service.creer(1, 1, {
      montant: 10000,
      jetonRetrait: signerJeton(1),
    });
    // objectifAtteintLe non null → atteint → 2,75 % → net = 10000 - 275 = 9725
    expect(transaction.montant).toBe(9725);
  });

  it("retrait total = solde entier de l'épargne (objectif non atteint)", async () => {
    const epargne = fabriqueEpargne({
      montant: 4000,
      objectifMontant: 20000,
      objectifAtteintLe: null,
    });
    configurerTransaction(epargne, 0, undefined, 13);
    txRepoMock.save = jest.fn().mockImplementation((tx: Partial<Transaction>) =>
      Promise.resolve({
        ...tx,
        id: 13,
        estRetraitTotal: true,
      } as Transaction),
    );
    const { transaction } = await service.creer(1, 1, {
      total: true,
      jetonRetrait: signerJeton(1),
    });
    // 4000 - 200 (5%) = 3800
    expect(transaction.montant).toBe(3800);
    expect(transaction.estRetraitTotal).toBe(true);
  });

  // ─── FedaPay indisponible ─────────────────────────────────────────────────
  it('marque la transaction ECHOUE si FedaPay échoue', async () => {
    configurerTransaction(fabriqueEpargne(), 0, undefined, 20);
    const saved: Transaction[] = [];
    txRepoMock.save = jest
      .fn()
      .mockImplementation((tx: Partial<Transaction>) => {
        const t = { ...tx, id: 20 } as Transaction;
        saved.push(t);
        return Promise.resolve(t);
      });
    jest
      .spyOn(fedapayFaux, 'creerEtEnvoyerPayout')
      .mockRejectedValue(new Error('KO'));
    await expect(
      service.creer(1, 1, { montant: 100, jetonRetrait: signerJeton(1) }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(saved.some((t) => t.statut === StatutTransaction.ECHOUE)).toBe(true);
  });

  // ─── Deux retraits parallèles : un seul passe ─────────────────────────────
  it('deux demandes simultanées avec le même jeton : une seule passe', async () => {
    let premier = true;
    const saveConcurrent = jest.fn().mockImplementation(() => {
      if (premier) {
        premier = false;
        return Promise.resolve({ id: 1, jti: 'jti-c' });
      }
      return Promise.reject(new Error('duplicate key'));
    });
    txRepoMock.manager.transaction.mockImplementation(
      async (cb: (m: unknown) => Promise<void>) => {
        const manager = fabriqueManager(
          fabriqueEpargne({ montant: 10000 }),
          0,
          saveConcurrent,
        );
        manager.getRepository('Transaction' as never).save = jest.fn(
          (tx: Partial<Transaction>) =>
            Promise.resolve({ ...tx, id: 42 } as Transaction),
        );
        await cb(manager);
      },
    );
    fedapayFaux.definirIdFedapayPayout('PO-PARALLELE');
    txRepoMock.save = jest.fn().mockResolvedValue({ id: 42 } as Transaction);
    const jeton = signerJeton(1);
    const [r1, r2] = await Promise.allSettled([
      service.creer(1, 1, { montant: 100, jetonRetrait: jeton }),
      service.creer(1, 1, { montant: 100, jetonRetrait: jeton }),
    ]);
    const ok = [r1, r2].filter((r) => r.status === 'fulfilled');
    const ko = [r1, r2].filter((r) => r.status === 'rejected');
    expect(ok).toHaveLength(1);
    expect(ko).toHaveLength(1);
    if (ko[0].status === 'rejected') {
      expect(ko[0].reason).toBeInstanceOf(UnauthorizedException);
    }
  });
});

// ─── TransactionService.confirmerRetraitEpargne ───────────────────────────────
describe('TransactionService.confirmerRetraitEpargne', () => {
  let transactionService: TransactionService;
  let fedapayFaux: FedapayClientFaux;
  let txRepoMock: { findOne: jest.Mock; save: jest.Mock };
  let notifMock: { create: jest.Mock };

  beforeEach(async () => {
    fedapayFaux = new FedapayClientFaux();
    fedapayFaux.definirFeesPayout(0);
    txRepoMock = {
      findOne: jest.fn(),
      save: jest
        .fn()
        .mockImplementation((tx: Transaction) => Promise.resolve(tx)),
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

  function fabriqueTransaction(
    overrides: Partial<Transaction> = {},
  ): Transaction {
    return Object.assign(new Transaction(), {
      id: 1,
      type: TypeTransaction.RETRAIT,
      montant: 9500,
      fraisFedapay: 0,
      referenceUnique: 'TX-1-20250101-abcd1234',
      idFedapay: 'PO100',
      statut: StatutTransaction.EN_ATTENTE,
      joursCibles: null,
      estRetraitTotal: false,
      membre: { id: 1 },
      epargne: {
        id: 1,
        montant: 10000,
        dateEcheance: null,
        statut: StatutEpargne.ACTIVE,
        objectifMontant: 20000,
        objectifAtteintLe: null,
      },
      retraitEpargne: {
        id: 1,
        montant: 10000,
        tauxApplique: 5,
        montantRetenu: 500,
        estAnticipe: true, // objectif non atteint → pénalité
      } as RetraitEpargne,
      ...overrides,
    });
  }

  function fabriqueManager(tx: Transaction) {
    const ecritures: EcritureComptable[] = [];
    const caisses: CaisseApplication[] = [];
    const portefeuilleMaj: Partial<Portefeuille>[] = [];
    const epargnesMaj: Epargne[] = [];
    const sum = (pred: (e: EcritureComptable) => boolean) =>
      ecritures.filter(pred).reduce((s, e) => s + e.montant, 0);
    const recalculQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockImplementation(() =>
        Promise.resolve({
          coti_credit: '0',
          coti_debit: '0',
          retrait_debit: '0',
          epargne_credit: String(
            sum(
              (e) =>
                e.type === TypeEcriture.EPARGNE &&
                e.sens === SensEcriture.CREDIT,
            ),
          ),
          epargne_debit: String(
            sum(
              (e) =>
                [
                  TypeEcriture.EPARGNE,
                  TypeEcriture.RETRAIT_EPARGNE,
                  TypeEcriture.PENALITE,
                  TypeEcriture.RETENUE_EPARGNE,
                ].includes(e.type) && e.sens === SensEcriture.DEBIT,
            ),
          ),
          bloque_credit: '0',
          bloque_debit: '0',
        }),
      ),
    };
    const ecritureRepoMock = {
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation(async (e: EcritureComptable) => {
        ecritures.push(e);
        return { ...(e as object), id: ecritures.length } as EcritureComptable;
      }),
      createQueryBuilder: jest.fn().mockReturnValue(recalculQb),
    };
    const caisseRepoMock = {
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation(async (c: CaisseApplication) => {
        caisses.push(c);
        return c;
      }),
    };
    const epargneRepoMock = {
      findOne: jest.fn().mockResolvedValue(
        Object.assign(new Epargne(), {
          id: 1,
          montant: tx.epargne?.montant ?? 10000,
          dateEcheance: null,
          statut: StatutEpargne.ACTIVE,
          objectifMontant: (tx.epargne as Epargne)?.objectifMontant ?? 20000,
          objectifAtteintLe: (tx.epargne as Epargne)?.objectifAtteintLe ?? null,
        }),
      ),
      save: jest.fn().mockImplementation(async (e: Epargne) => {
        epargnesMaj.push(e);
        return e;
      }),
    };
    const portefeuilleRepoMock = {
      update: jest
        .fn()
        .mockImplementation(async (_w: unknown, v: Partial<Portefeuille>) => {
          portefeuilleMaj.push(v);
        }),
    };
    const txRepoInternal = {
      findOne: jest.fn().mockResolvedValue(tx),
      save: jest.fn().mockImplementation(async (t: Transaction) => t),
      update: jest.fn().mockResolvedValue(undefined),
    };
    const getRepository = jest.fn().mockImplementation((entity: unknown) => {
      const name = (entity as { name?: string }).name ?? String(entity);
      if (name === 'Transaction') return txRepoInternal;
      if (name === 'EcritureComptable') return ecritureRepoMock;
      if (name === 'CaisseApplication') return caisseRepoMock;
      if (name === 'Epargne') return epargneRepoMock;
      if (name === 'Portefeuille') return portefeuilleRepoMock;
      return {};
    });
    return {
      getRepository,
      _ecritures: ecritures,
      _caisses: caisses,
      _portefeuilleMaj: portefeuilleMaj,
      _epargnesMaj: epargnesMaj,
    };
  }

  it('objectif non atteint (estAnticipe=true) : écritures retrait_epargne 9500 + pénalité 500, caisse source penalite', async () => {
    const tx = fabriqueTransaction({ montant: 9500 });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const retraitEcr = manager._ecritures.find(
      (e) => e.type === TypeEcriture.RETRAIT_EPARGNE,
    );
    const penaliteEcr = manager._ecritures.find(
      (e) => e.type === TypeEcriture.PENALITE,
    );
    expect(retraitEcr).toBeDefined();
    expect(retraitEcr!.montant).toBe(9500);
    expect(retraitEcr!.sens).toBe(SensEcriture.DEBIT);
    expect(penaliteEcr).toBeDefined();
    expect(penaliteEcr!.montant).toBe(500);
    // Somme des deux écritures = montant demandé (10 000).
    expect(retraitEcr!.montant + penaliteEcr!.montant).toBe(10000);
    expect(manager._caisses).toHaveLength(1);
    expect(
      (manager._caisses[0] as unknown as Record<string, unknown>)['source'],
    ).toBe(SourceCaisse.PENALITE);
    expect(manager._ecritures.every((e) => e.cycle === null)).toBe(true);
  });

  it('objectif atteint (estAnticipe=false) : retenue_epargne 275, caisse source retenue_epargne', async () => {
    const tx = fabriqueTransaction({
      montant: 9725,
      retraitEpargne: {
        id: 2,
        montant: 10000,
        tauxApplique: 2.75,
        montantRetenu: 275,
        estAnticipe: false, // objectif atteint → retenue
      } as RetraitEpargne,
    });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const retenueEcr = manager._ecritures.find(
      (e) => e.type === TypeEcriture.RETENUE_EPARGNE,
    );
    const retraitEcr = manager._ecritures.find(
      (e) => e.type === TypeEcriture.RETRAIT_EPARGNE,
    );
    expect(retraitEcr!.montant).toBe(9725);
    expect(retenueEcr).toBeDefined();
    expect(retenueEcr!.montant).toBe(275);
    expect(retraitEcr!.montant + retenueEcr!.montant).toBe(10000);
    expect(
      (manager._caisses[0] as unknown as Record<string, unknown>)['source'],
    ).toBe(SourceCaisse.RETENUE_EPARGNE);
  });

  it('retrait total : épargne passe à 0 → statut retiree', async () => {
    const tx = fabriqueTransaction({
      montant: 9500,
      estRetraitTotal: true,
      epargne: {
        id: 1,
        montant: 10000,
        dateEcheance: null,
        statut: StatutEpargne.ACTIVE,
        objectifMontant: 20000,
        objectifAtteintLe: null,
      } as Epargne,
    });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const epargneMaj = manager._epargnesMaj[0];
    expect(epargneMaj.montant).toBe(0);
    expect(epargneMaj.statut).toBe(StatutEpargne.RETIREE);
  });

  it("retrait partiel : l'épargne reste active si le solde > 0", async () => {
    const tx = fabriqueTransaction({
      montant: 4750, // 5000 - 250 (5%)
      epargne: {
        id: 1,
        montant: 10000,
        dateEcheance: null,
        statut: StatutEpargne.ACTIVE,
        objectifMontant: 20000,
        objectifAtteintLe: null,
      } as Epargne,
      retraitEpargne: {
        id: 3,
        montant: 5000,
        tauxApplique: 5,
        montantRetenu: 250,
        estAnticipe: true,
      } as RetraitEpargne,
    });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const epargneMaj = manager._epargnesMaj[0];
    expect(epargneMaj.montant).toBe(5000); // 10000 - 5000
    expect(epargneMaj.statut).toBe(StatutEpargne.ACTIVE);
  });

  it("objectifAtteintLe reste acquis après retrait partiel : le retrait suivant est à 2,75 %", async () => {
    // Scénario : objectif atteint, puis retrait partiel, puis nouveau retrait.
    // estAnticipe=false (objectif acquis) → retenue_epargne même si montant < objectif.
    const dateAtteinte = new Date('2026-03-01T10:00:00Z');
    const tx = fabriqueTransaction({
      montant: 9725, // 2,75 %
      epargne: {
        id: 1,
        montant: 10000,
        dateEcheance: null,
        statut: StatutEpargne.ACTIVE,
        objectifMontant: 20000,
        objectifAtteintLe: dateAtteinte,
      } as Epargne,
      retraitEpargne: {
        id: 4,
        montant: 10000,
        tauxApplique: 2.75,
        montantRetenu: 275,
        estAnticipe: false, // objectif acquis
      } as RetraitEpargne,
    });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const retenueEcr = manager._ecritures.find(
      (e) => e.type === TypeEcriture.RETENUE_EPARGNE,
    );
    expect(retenueEcr).toBeDefined();
    expect(retenueEcr!.montant).toBe(275);
    expect(
      (manager._caisses[0] as unknown as Record<string, unknown>)['source'],
    ).toBe(SourceCaisse.RETENUE_EPARGNE);
  });

  it('portefeuille recalculé après retrait (soldeEpargne mis à jour)', async () => {
    const tx = fabriqueTransaction({ montant: 9500 });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    expect(manager._portefeuilleMaj).toHaveLength(1);
    // soldeEpargne = epargne_credit(0) - epargne_debit(9500+500=10000) → max(0,...) = 0.
    expect(manager._portefeuilleMaj[0].soldeEpargne).toBe(0);
    expect(manager._portefeuilleMaj[0].soldeCotisation).toBe(0);
  });

  it('échec (echouer) : aucune écriture créée', async () => {
    const tx = fabriqueTransaction({ statut: StatutTransaction.EN_ATTENTE });
    const manager = fabriqueManager(tx);
    await transactionService.echouer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    expect(manager._ecritures).toHaveLength(0);
  });

  it('confirmer() : RETRAIT + epargne_id → confirmerRetraitEpargne, jamais confirmerDepot', async () => {
    const tx = fabriqueTransaction({ montant: 9500 });
    expect(tx.type).toBe(TypeTransaction.RETRAIT);
    expect(tx.epargne).not.toBeNull();
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    expect(
      manager._ecritures.some((e) => e.type === TypeEcriture.COTISATION),
    ).toBe(false);
    expect(
      manager._ecritures.some((e) => e.type === TypeEcriture.RETRAIT_EPARGNE),
    ).toBe(true);
  });

  // ─── Webhook rejoué (double confirmation) : idempotence ──────────────────

  it('webhook rejoué : confirmer() sur une transaction déjà REUSSI — aucune écriture supplémentaire', async () => {
    const tx = fabriqueTransaction({
      montant: 9500,
      statut: StatutTransaction.EN_ATTENTE,
    });
    const manager = fabriqueManager(tx);

    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const ecrituresApres1 = manager._ecritures.length;
    const caissesApres1 = manager._caisses.length;
    const epargneMajApres1 = manager._epargnesMaj.length;
    const portefeuilleApres1 = manager._portefeuilleMaj.length;

    const txRepoInternal = (
      manager.getRepository as (e: { name: string }) => {
        findOne: jest.Mock;
        save: jest.Mock;
      }
    )({ name: 'Transaction' });
    txRepoInternal.findOne.mockResolvedValue({
      ...tx,
      statut: StatutTransaction.REUSSI,
    });

    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );

    expect(manager._ecritures.length).toBe(ecrituresApres1);
    expect(manager._caisses.length).toBe(caissesApres1);
    expect(manager._epargnesMaj.length).toBe(epargneMajApres1);
    expect(manager._portefeuilleMaj.length).toBe(portefeuilleApres1);
  });

  it('idempotence — dépôt épargne : deux confirmations séquentielles → même état', async () => {
    const txDepot = Object.assign(new Transaction(), {
      id: 2,
      type: TypeTransaction.DEPOT,
      montant: 5000,
      fraisFedapay: 0,
      referenceUnique: 'TX-1-DEP',
      idFedapay: 'TX200',
      statut: StatutTransaction.EN_ATTENTE,
      membre: { id: 1 },
      epargne: {
        id: 1,
        montant: 0,
        dateEcheance: null,
        statut: StatutEpargne.ACTIVE,
        objectifMontant: 10000,
        objectifAtteintLe: null,
      },
      retraitEpargne: undefined,
    });
    const managerDepot = fabriqueManager(txDepot);

    await transactionService.confirmer(
      2,
      managerDepot as unknown as Parameters<
        typeof transactionService.confirmer
      >[1],
    );
    const nbEcr1 = managerDepot._ecritures.length;
    const nbCaisse1 = managerDepot._caisses.length;
    const epargneVal1 = managerDepot._epargnesMaj[0]?.montant;
    const soldeEpargne1 = managerDepot._portefeuilleMaj[0]?.soldeEpargne;

    const txDepotRepo = (
      managerDepot.getRepository as (e: { name: string }) => {
        findOne: jest.Mock;
      }
    )({ name: 'Transaction' });
    txDepotRepo.findOne.mockResolvedValue({
      ...txDepot,
      statut: StatutTransaction.REUSSI,
    });

    await transactionService.confirmer(
      2,
      managerDepot as unknown as Parameters<
        typeof transactionService.confirmer
      >[1],
    );

    expect(managerDepot._ecritures.length).toBe(nbEcr1);
    expect(managerDepot._caisses.length).toBe(nbCaisse1);
    expect(managerDepot._epargnesMaj.length).toBe(1);
    expect(managerDepot._epargnesMaj[0].montant).toBe(epargneVal1);
    expect(managerDepot._portefeuilleMaj[0]?.soldeEpargne).toBe(soldeEpargne1);
  });

  it('idempotence — retrait épargne : deux confirmations parallèles → même état (une seule écriture)', async () => {
    const tx = fabriqueTransaction({
      montant: 9500,
      statut: StatutTransaction.EN_ATTENTE,
    });

    const manager1 = fabriqueManager(tx);
    const manager2 = fabriqueManager({
      ...tx,
      statut: StatutTransaction.REUSSI,
    });

    const [r1, r2] = await Promise.allSettled([
      transactionService.confirmer(
        1,
        manager1 as unknown as Parameters<
          typeof transactionService.confirmer
        >[1],
      ),
      transactionService.confirmer(
        1,
        manager2 as unknown as Parameters<
          typeof transactionService.confirmer
        >[1],
      ),
    ]);

    expect(r1.status).toBe('fulfilled');
    expect(r2.status).toBe('fulfilled');

    expect(manager1._ecritures).toHaveLength(2);
    expect(manager1._caisses).toHaveLength(1);
    expect(manager1._epargnesMaj).toHaveLength(1);

    expect(manager2._ecritures).toHaveLength(0);
    expect(manager2._caisses).toHaveLength(0);
    expect(manager2._epargnesMaj).toHaveLength(0);
  });

  it('idempotence — dépôt épargne : deux confirmations parallèles → même état', async () => {
    const txDepot = Object.assign(new Transaction(), {
      id: 3,
      type: TypeTransaction.DEPOT,
      montant: 5000,
      fraisFedapay: 0,
      referenceUnique: 'TX-DEP-PARA',
      idFedapay: 'TX300',
      statut: StatutTransaction.EN_ATTENTE,
      membre: { id: 1 },
      epargne: {
        id: 1,
        montant: 0,
        dateEcheance: null,
        statut: StatutEpargne.ACTIVE,
        objectifMontant: 10000,
        objectifAtteintLe: null,
      },
      retraitEpargne: undefined,
    });

    const managerA = fabriqueManager(txDepot);
    const managerB = fabriqueManager({
      ...txDepot,
      statut: StatutTransaction.REUSSI,
    });

    const [rA, rB] = await Promise.allSettled([
      transactionService.confirmer(
        3,
        managerA as unknown as Parameters<
          typeof transactionService.confirmer
        >[1],
      ),
      transactionService.confirmer(
        3,
        managerB as unknown as Parameters<
          typeof transactionService.confirmer
        >[1],
      ),
    ]);

    expect(rA.status).toBe('fulfilled');
    expect(rB.status).toBe('fulfilled');

    expect(managerA._ecritures).toHaveLength(1);
    expect(managerA._ecritures[0].type).toBe(TypeEcriture.EPARGNE);
    expect(managerA._epargnesMaj).toHaveLength(1);

    expect(managerB._ecritures).toHaveLength(0);
    expect(managerB._epargnesMaj).toHaveLength(0);
    expect(managerB._portefeuilleMaj).toHaveLength(0);
  });

  it("isolation entre membres : retrait de alice ne touche pas l'épargne de bob", async () => {
    // Vérification structurelle : toutes les écritures créées portent membreId=1.
    const tx = fabriqueTransaction({ montant: 9500 });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    // Toutes les écritures pointent vers le membre 1.
    expect(
      manager._ecritures.every(
        (e) => (e.membre as { id: number })?.id === 1,
      ),
    ).toBe(true);
  });

  it('retrait échoué (echouer) : aucune écriture, épargne inchangée', async () => {
    const tx = fabriqueTransaction({ statut: StatutTransaction.EN_ATTENTE });
    const manager = fabriqueManager(tx);
    await transactionService.echouer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    expect(manager._ecritures).toHaveLength(0);
    expect(manager._epargnesMaj).toHaveLength(0);
  });
});
