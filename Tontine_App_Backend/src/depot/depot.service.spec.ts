/**
 * Tests unitaires du flux depot FedaPay.
 *
 * Strategie :
 * - FedapayClientFaux pour simuler FedaPay sans appel reseau.
 * - Mocks manuels des repos TypeORM (sans importer @nestjs/typeorm ESM).
 * - TransactionService partiellement mocke pour confirmer() / echouer().
 * - Les tests de confirmer() sont integres dans TransactionService directement
 *   (via EntityManager mocke) pour verifier les effets sur ecritures + portefeuille.
 */

import {
  BadRequestException,
  ConflictException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { DepotService, calculerFrais } from './depot.service';
import { TransactionService } from '../transaction/transaction.service';
import { CycleService } from '../cycle/cycle.service';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { FedapayClientFaux } from '../fedapay/fedapay-client.faux';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import { WebhookFedapayService } from '../webhook-fedapay/webhook-fedapay.service';
import { WebhookFedapay } from '../webhook-fedapay/entities/webhook-fedapay.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { CaisseApplication } from '../caisse-application/entities/caisse-application.entity';
import { JourCotisation } from '../jour-cotisation/entities/jour-cotisation.entity';
import { Cycle } from '../cycle/entities/cycle.entity';
import {
  SensEcriture,
  SourceCaisse,
  StatutJourCotisation,
  StatutTransaction,
  TypeEcriture,
  TypeTransaction,
} from '../common/enums';

// ─── Tokens (reproduit le stub nestjs-typeorm.mock.ts) ───────────────────────
const TX_REPO = `${Transaction.name}Repository`;
const MEMBRE_REPO = `${Membre.name}Repository`;
const WEBHOOK_REPO = `${WebhookFedapay.name}Repository`;
const CYCLE_REPO = `${Cycle.name}Repository`;
const JOUR_REPO = `${JourCotisation.name}Repository`;
const ECRITURE_REPO = `${EcritureComptable.name}Repository`;
const CAISSE_REPO = `${CaisseApplication.name}Repository`;
const PORTEFEUILLE_REPO = `${Portefeuille.name}Repository`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fabriqueMembre(overrides: Partial<Membre> = {}): Membre {
  return Object.assign(new Membre(), {
    id: 1,
    nom: 'Alice Test',
    phone: '97000001',
    role: 'membre',
    statut: 'actif',
    ...overrides,
  });
}

function fabriqueJour(overrides: Partial<JourCotisation> = {}): JourCotisation {
  return Object.assign(new JourCotisation(), {
    id: 10,
    numeroJour: 1,
    datePrevue: '2025-01-01',
    coefficient: 1,
    montantDu: 500,
    montantPaye: 0,
    statut: StatutJourCotisation.A_PAYER,
    cycle: { id: 5, fondsCaisseRetenu: 500 } as Cycle,
    ...overrides,
  });
}

function fabriqueTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return Object.assign(new Transaction(), {
    id: 1,
    type: TypeTransaction.DEPOT,
    montant: 500,
    fraisFedapay: 0,
    referenceUnique: 'TX-1-20250101-abcd1234',
    idFedapay: '12345',
    statut: StatutTransaction.EN_ATTENTE,
    joursCibles: [10],
    dateOperation: new Date(),
    membre: fabriqueMembre(),
    ...overrides,
  });
}

function getCurrentDateStr(): string {
  const now = new Date();
  const offset = 60 * 60 * 1000; // UTC+1 Benin
  const beninNow = new Date(now.getTime() + offset);
  return beninNow.toISOString().slice(0, 10);
}

// ─── Tests calculerFrais ─────────────────────────────────────────────────────

describe('calculerFrais', () => {
  it('calcule les frais correctement', () => {
    expect(calculerFrais(1000, 1.5)).toBe(15);
    expect(calculerFrais(1000, 0)).toBe(0);
    expect(calculerFrais(333, 1)).toBe(3);
  });
});

// ─── DepotService ────────────────────────────────────────────────────────────

describe('DepotService', () => {
  let service: DepotService;
  let fedapayFaux: FedapayClientFaux;

  const txRepoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    manager: { transaction: jest.fn() },
  };

  const membreRepoMock = {
    findOneBy: jest.fn(),
  };

  const cycleServiceMock: Partial<CycleService> = {
    enCours: jest.fn(),
    rattraperJours: jest.fn(),
  };

  const parametresMock: Partial<ParametreSystemeService> = {
    getNumber: jest.fn().mockResolvedValue(0),
  };

  const configServiceMock = {
    get: jest.fn().mockReturnValue({ appPublicUrl: 'https://example.com', env: 'sandbox' }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    fedapayFaux = new FedapayClientFaux();
    fedapayFaux.definirStatut('pending');
    fedapayFaux.definirFees(0);
    fedapayFaux.definirSignatureValide(true);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepotService,
        { provide: TX_REPO, useValue: txRepoMock },
        { provide: MEMBRE_REPO, useValue: membreRepoMock },
        { provide: CycleService, useValue: cycleServiceMock },
        { provide: ParametreSystemeService, useValue: parametresMock },
        { provide: FEDAPAY_CLIENT, useValue: fedapayFaux },
        { provide: ConfigService, useValue: configServiceMock },
      ],
    }).compile();

    service = module.get<DepotService>(DepotService);
  });

  describe('creer - premier depot du jour', () => {
    it('cree la transaction, appelle FedaPay, retourne urlPaiement', async () => {
      const membre = fabriqueMembre();
      const jour = fabriqueJour({ datePrevue: getCurrentDateStr() });

      (cycleServiceMock.enCours as jest.Mock).mockResolvedValue({
        jours: [{ ...jour, statut: StatutJourCotisation.A_PAYER }],
      });
      txRepoMock.find.mockResolvedValue([]);
      membreRepoMock.findOneBy.mockResolvedValue(membre);
      txRepoMock.create.mockReturnValue(fabriqueTransaction());
      txRepoMock.save.mockImplementation(async (t: Transaction) => t);

      const resultat = await service.creer(membre.id, {});

      expect(resultat.urlPaiement).toContain('fedapay.com');
      expect(txRepoMock.save).toHaveBeenCalled();
    });

    it('400 si aucun jour a payer aujourd\'hui', async () => {
      (cycleServiceMock.enCours as jest.Mock).mockResolvedValue({
        jours: [fabriqueJour({ datePrevue: '1970-01-01' })],
      });
      txRepoMock.find.mockResolvedValue([]);

      await expect(service.creer(1, {})).rejects.toThrow(BadRequestException);
    });
  });

  describe('creer - double-clic', () => {
    it('renvoie la transaction existante si meme jourIds dans les 10 min', async () => {
      const membre = fabriqueMembre();
      const jour = fabriqueJour({ datePrevue: getCurrentDateStr() });
      const txExistante = fabriqueTransaction({
        joursCibles: [jour.id],
        dateOperation: new Date(),
      });

      (cycleServiceMock.enCours as jest.Mock).mockResolvedValue({
        jours: [{ ...jour, statut: StatutJourCotisation.A_PAYER }],
      });
      txRepoMock.find.mockResolvedValue([txExistante]);
      membreRepoMock.findOneBy.mockResolvedValue(membre);

      const resultat = await service.creer(membre.id, {});

      expect(resultat.transaction.id).toBe(txExistante.id);
      expect(resultat.urlPaiement).toBeNull();
    });

    it('409 si un jour est deja dans une autre transaction en_attente', async () => {
      const membre = fabriqueMembre();
      const jour = fabriqueJour({ datePrevue: getCurrentDateStr() });
      const vieilleTx = fabriqueTransaction({
        joursCibles: [jour.id],
        dateOperation: new Date(Date.now() - 20 * 60 * 1000),
      });

      (cycleServiceMock.enCours as jest.Mock).mockResolvedValue({
        jours: [{ ...jour, statut: StatutJourCotisation.A_PAYER }],
      });
      txRepoMock.find.mockResolvedValue([vieilleTx]);

      await expect(service.creer(membre.id, {})).rejects.toThrow(ConflictException);
    });
  });

  describe('creer - rattrapage', () => {
    it('utilise CycleService.rattraperJours pour calculer le total', async () => {
      const membre = fabriqueMembre();
      const jour1 = fabriqueJour({ id: 11, montantDu: 500, statut: StatutJourCotisation.PERDU });
      const jour2 = fabriqueJour({ id: 12, montantDu: 500, statut: StatutJourCotisation.PERDU });

      (cycleServiceMock.rattraperJours as jest.Mock).mockResolvedValue({
        jours: [jour1, jour2],
        total: 1000,
      });
      txRepoMock.find.mockResolvedValue([]);
      membreRepoMock.findOneBy.mockResolvedValue(membre);
      txRepoMock.create.mockReturnValue(fabriqueTransaction({ montant: 1000, joursCibles: [11, 12] }));
      txRepoMock.save.mockImplementation(async (t: Transaction) => t);

      const resultat = await service.creer(membre.id, { jourIds: [11, 12] });

      expect(cycleServiceMock.rattraperJours).toHaveBeenCalledWith([11, 12], membre.id);
      expect(resultat.transaction.montant).toBe(1000);
    });
  });

  describe('creer - FedaPay indisponible', () => {
    it('passe la transaction a ECHOUE et leve ServiceUnavailableException', async () => {
      const membre = fabriqueMembre();
      const jour = fabriqueJour({ datePrevue: getCurrentDateStr() });

      (cycleServiceMock.enCours as jest.Mock).mockResolvedValue({
        jours: [{ ...jour, statut: StatutJourCotisation.A_PAYER }],
      });
      txRepoMock.find.mockResolvedValue([]);
      membreRepoMock.findOneBy.mockResolvedValue(membre);
      const tx = fabriqueTransaction();
      txRepoMock.create.mockReturnValue(tx);
      txRepoMock.save.mockImplementation(async (t: Transaction) => t);

      jest.spyOn(fedapayFaux, 'creerTransaction').mockRejectedValue(new Error('Reseau KO'));

      await expect(service.creer(membre.id, {})).rejects.toThrow(
        ServiceUnavailableException,
      );

      const dernierSave = txRepoMock.save.mock.calls.at(-1)?.[0] as Transaction;
      expect(dernierSave?.statut).toBe(StatutTransaction.ECHOUE);
    });
  });

  describe('isolation membres', () => {
    it('ne voit pas les transactions d\'un autre membre (CycleService leve 404)', async () => {
      (cycleServiceMock.enCours as jest.Mock).mockRejectedValue(
        new NotFoundException('Aucun cycle en cours.'),
      );

      await expect(service.creer(999, {})).rejects.toThrow(NotFoundException);
    });
  });
});

// ─── TransactionService.confirmer ────────────────────────────────────────────

describe('TransactionService - confirmer()', () => {
  let txService: TransactionService;
  let fedapayFaux: FedapayClientFaux;

  const txRepoMock = {
    find: jest.fn(),
    findOne: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
    manager: { transaction: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    fedapayFaux = new FedapayClientFaux();
    fedapayFaux.definirStatut('approved');
    fedapayFaux.definirFees(50);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: TX_REPO, useValue: txRepoMock },
        { provide: FEDAPAY_CLIENT, useValue: fedapayFaux },
      ],
    }).compile();

    txService = module.get<TransactionService>(TransactionService);
  });

  it('1. Premier depot : ecriture cotisation + fonds_caisse crees', async () => {
    const membre = fabriqueMembre();
    const jour = fabriqueJour({ montantDu: 500, montantPaye: 0 });
    const cycle = { id: 5, fondsCaisseRetenu: 500 } as Cycle;
    jour.cycle = cycle;

    const transaction = fabriqueTransaction({
      id: 1,
      idFedapay: '12345',
      joursCibles: [jour.id],
      membre,
    });

    const ecrituresSauvegardees: EcritureComptable[] = [];
    const caisseSauvegardee: CaisseApplication[] = [];
    const portefeuilleMaj: Partial<Portefeuille>[] = [];

    const jourRepoMock = {
      find: jest.fn().mockResolvedValue([jour]),
      save: jest.fn().mockImplementation(async (j: JourCotisation) => j),
    };
    const ecritureRepoMock = {
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation(async (e: EcritureComptable) => {
        ecrituresSauvegardees.push(e as EcritureComptable);
        return { ...(e as object), id: ecrituresSauvegardees.length } as EcritureComptable;
      }),
      count: jest.fn().mockResolvedValue(0), // premier depot
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({
          '0': '500', '1': '0', '2': '0', '3': '0', '4': '0', '5': '0',
        }),
      }),
    };
    const cycleRepoMock = {
      findOne: jest.fn().mockResolvedValue(cycle),
    };
    const caisseRepoMock = {
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation(async (c: CaisseApplication) => {
        caisseSauvegardee.push(c as CaisseApplication);
        return c;
      }),
    };
    const txRepoInterne = {
      findOne: jest.fn().mockResolvedValue(transaction),
      save: jest.fn().mockImplementation(async (t: Transaction) => t),
      update: jest.fn(),
    };
    const portefeuilleRepoMock = {
      update: jest.fn().mockImplementation(
        async (_where: unknown, vals: Partial<Portefeuille>) => {
          portefeuilleMaj.push(vals);
        },
      ),
    };

    const manager = {
      getRepository: jest.fn((entity: { name: string }) => {
        const map: Record<string, unknown> = {
          [Transaction.name]: txRepoInterne,
          [JourCotisation.name]: jourRepoMock,
          [EcritureComptable.name]: ecritureRepoMock,
          [Cycle.name]: cycleRepoMock,
          [CaisseApplication.name]: caisseRepoMock,
          [Portefeuille.name]: portefeuilleRepoMock,
        };
        return map[entity.name] ?? {};
      }),
    };

    await txService.confirmer(1, manager as Parameters<typeof txService.confirmer>[1]);

    // Statut = REUSSI
    const txSauve = (txRepoInterne.save as jest.Mock).mock.calls[0][0] as Transaction;
    expect(txSauve.statut).toBe(StatutTransaction.REUSSI);
    expect(txSauve.fraisFedapay).toBe(50);

    // Ecriture cotisation
    const ecritureCotisation = ecrituresSauvegardees.find(
      (e) => (e as unknown as Record<string, unknown>)['type'] === TypeEcriture.COTISATION,
    );
    expect(ecritureCotisation).toBeDefined();
    expect((ecritureCotisation as unknown as Record<string, unknown>)['sens']).toBe(SensEcriture.CREDIT);
    expect((ecritureCotisation as unknown as Record<string, unknown>)['montant']).toBe(500);

    // Ecriture fonds_caisse
    const ecritureFonds = ecrituresSauvegardees.find(
      (e) => (e as unknown as Record<string, unknown>)['type'] === TypeEcriture.FONDS_CAISSE,
    );
    expect(ecritureFonds).toBeDefined();
    expect((ecritureFonds as unknown as Record<string, unknown>)['sens']).toBe(SensEcriture.DEBIT);

    // CaisseApplication
    expect(caisseSauvegardee).toHaveLength(1);
    expect((caisseSauvegardee[0] as unknown as Record<string, unknown>)['source']).toBe(SourceCaisse.FONDS_CAISSE);
  });

  it('2. Deuxieme depot : pas de nouvelle ecriture fonds_caisse', async () => {
    const membre = fabriqueMembre();
    const jour = fabriqueJour({ montantDu: 500 });
    const cycle = { id: 5, fondsCaisseRetenu: 500 } as Cycle;
    jour.cycle = cycle;

    const transaction = fabriqueTransaction({
      id: 2,
      idFedapay: '12346',
      joursCibles: [jour.id],
      membre,
    });

    const ecrituresSauvegardees: EcritureComptable[] = [];

    const ecritureRepoMock = {
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation(async (e: EcritureComptable) => {
        ecrituresSauvegardees.push(e as EcritureComptable);
        return { ...(e as object), id: ecrituresSauvegardees.length } as EcritureComptable;
      }),
      count: jest.fn().mockResolvedValue(1), // deja une ecriture fonds_caisse
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ '0': '500', '1': '0', '2': '0', '3': '0', '4': '0', '5': '0' }),
      }),
    };

    const manager = {
      getRepository: jest.fn((entity: { name: string }) => {
        const map: Record<string, unknown> = {
          [Transaction.name]: {
            findOne: jest.fn().mockResolvedValue(transaction),
            save: jest.fn().mockImplementation(async (t: Transaction) => t),
          },
          [JourCotisation.name]: {
            find: jest.fn().mockResolvedValue([jour]),
            save: jest.fn().mockImplementation(async (j: JourCotisation) => j),
          },
          [EcritureComptable.name]: ecritureRepoMock,
          [Cycle.name]: { findOne: jest.fn().mockResolvedValue(cycle) },
          [CaisseApplication.name]: {
            create: jest.fn().mockImplementation((v: unknown) => v),
            save: jest.fn(),
          },
          [Portefeuille.name]: { update: jest.fn() },
        };
        return map[entity.name] ?? {};
      }),
    };

    await txService.confirmer(2, manager as Parameters<typeof txService.confirmer>[1]);

    const ecritureFonds = ecrituresSauvegardees.find(
      (e) => (e as unknown as Record<string, unknown>)['type'] === TypeEcriture.FONDS_CAISSE,
    );
    expect(ecritureFonds).toBeUndefined();
  });

  it('8. Rattrapage : jours perdu -> statut rattrape apres confirmer()', async () => {
    const membre = fabriqueMembre();
    const jourPerdu = fabriqueJour({
      id: 20,
      montantDu: 500,
      montantPaye: 0,
      statut: StatutJourCotisation.PERDU,
    });
    jourPerdu.cycle = { id: 5, fondsCaisseRetenu: 500 } as Cycle;

    const transaction = fabriqueTransaction({
      id: 3,
      idFedapay: '12347',
      joursCibles: [jourPerdu.id],
      membre,
    });

    let statutFinal = jourPerdu.statut;
    const jourRepoMock = {
      find: jest.fn().mockResolvedValue([jourPerdu]),
      save: jest.fn().mockImplementation(async (j: JourCotisation) => {
        statutFinal = j.statut;
        return j;
      }),
    };

    const manager = {
      getRepository: jest.fn((entity: { name: string }) => {
        const map: Record<string, unknown> = {
          [Transaction.name]: {
            findOne: jest.fn().mockResolvedValue(transaction),
            save: jest.fn().mockImplementation(async (t: Transaction) => t),
          },
          [JourCotisation.name]: jourRepoMock,
          [EcritureComptable.name]: {
            create: jest.fn().mockImplementation((v: unknown) => v),
            save: jest.fn().mockImplementation(async (e: EcritureComptable) => ({
              ...(e as object),
              id: 99,
            })),
            count: jest.fn().mockResolvedValue(1),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({ '0': '500', '1': '0', '2': '0', '3': '0', '4': '0', '5': '0' }),
            }),
          },
          [Cycle.name]: {
            findOne: jest.fn().mockResolvedValue(jourPerdu.cycle),
          },
          [CaisseApplication.name]: {
            create: jest.fn().mockImplementation((v: unknown) => v),
            save: jest.fn(),
          },
          [Portefeuille.name]: { update: jest.fn() },
        };
        return map[entity.name] ?? {};
      }),
    };

    await txService.confirmer(3, manager as Parameters<typeof txService.confirmer>[1]);

    expect(statutFinal).toBe(StatutJourCotisation.RATTRAPE);
  });

  it('9. Portefeuille recalcule apres confirmer()', async () => {
    const membre = fabriqueMembre();
    const jour = fabriqueJour({ montantDu: 500 });
    jour.cycle = { id: 5, fondsCaisseRetenu: 500 } as Cycle;

    const transaction = fabriqueTransaction({
      id: 4,
      idFedapay: '12348',
      joursCibles: [jour.id],
      membre,
    });

    const portefeuilleMaj: Partial<Portefeuille>[] = [];

    const manager = {
      getRepository: jest.fn((entity: { name: string }) => {
        const map: Record<string, unknown> = {
          [Transaction.name]: {
            findOne: jest.fn().mockResolvedValue(transaction),
            save: jest.fn().mockImplementation(async (t: Transaction) => t),
          },
          [JourCotisation.name]: {
            find: jest.fn().mockResolvedValue([jour]),
            save: jest.fn().mockImplementation(async (j: JourCotisation) => j),
          },
          [EcritureComptable.name]: {
            create: jest.fn().mockImplementation((v: unknown) => v),
            save: jest.fn().mockImplementation(async (e: EcritureComptable) => ({ ...(e as object), id: 1 })),
            count: jest.fn().mockResolvedValue(0),
            createQueryBuilder: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              getRawOne: jest.fn().mockResolvedValue({
                '0': '500', '1': '0', '2': '0', '3': '0', '4': '0', '5': '0',
              }),
            }),
          },
          [Cycle.name]: {
            findOne: jest.fn().mockResolvedValue(jour.cycle),
          },
          [CaisseApplication.name]: {
            create: jest.fn().mockImplementation((v: unknown) => v),
            save: jest.fn(),
          },
          [Portefeuille.name]: {
            update: jest.fn().mockImplementation(
              async (_where: unknown, vals: Partial<Portefeuille>) => {
                portefeuilleMaj.push(vals);
              },
            ),
          },
        };
        return map[entity.name] ?? {};
      }),
    };

    await txService.confirmer(4, manager as Parameters<typeof txService.confirmer>[1]);

    expect(portefeuilleMaj).toHaveLength(1);
    expect(portefeuilleMaj[0].soldeCotisation).toBe(500);
    expect(portefeuilleMaj[0].soldeEpargne).toBe(0);
    expect(portefeuilleMaj[0].soldeBloque).toBe(0);
  });

  it('10. Isolation membres : findOne respecte l\'appartenance', async () => {
    const txAutreMembre = fabriqueTransaction({
      id: 99,
      membre: fabriqueMembre({ id: 2 }),
    });
    txRepoMock.findOne.mockResolvedValue(txAutreMembre);

    const module2 = await Test.createTestingModule({
      providers: [
        TransactionService,
        { provide: TX_REPO, useValue: txRepoMock },
        { provide: FEDAPAY_CLIENT, useValue: fedapayFaux },
      ],
    }).compile();

    const txSvc2 = module2.get<TransactionService>(TransactionService);

    // Sans filtre membreId -> retourne
    const result = await txSvc2.findOne(99, undefined);
    expect(result.id).toBe(99);

    // Avec filtre membreId=1 -> 404
    txRepoMock.findOne.mockResolvedValue(txAutreMembre);
    await expect(txSvc2.findOne(99, 1)).rejects.toThrow(NotFoundException);
  });
});

// ─── WebhookFedapayService ────────────────────────────────────────────────────

describe('WebhookFedapayService', () => {
  let fedapayFaux: FedapayClientFaux;

  const webhookRepoBase = {
    find: jest.fn(),
    findOne: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    update: jest.fn(),
  };

  const txRepoBase = {
    findOne: jest.fn(),
    find: jest.fn(),
    manager: { transaction: jest.fn() },
  };

  const txServiceBase = {
    confirmer: jest.fn().mockResolvedValue(undefined),
    echouer: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    fedapayFaux = new FedapayClientFaux();
    fedapayFaux.definirSignatureValide(true);
  });

  async function buildWebhookService(overrides?: {
    webhookRepo?: unknown;
    txRepo?: unknown;
    txService?: unknown;
    fedapay?: FedapayClientFaux;
  }): Promise<WebhookFedapayService> {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookFedapayService,
        { provide: WEBHOOK_REPO, useValue: overrides?.webhookRepo ?? webhookRepoBase },
        { provide: TX_REPO, useValue: overrides?.txRepo ?? txRepoBase },
        { provide: TransactionService, useValue: overrides?.txService ?? txServiceBase },
        { provide: FEDAPAY_CLIENT, useValue: overrides?.fedapay ?? fedapayFaux },
      ],
    }).compile();
    return module.get<WebhookFedapayService>(WebhookFedapayService);
  }

  it('3. Webhook rejoue : confirmer() n\'est pas rappele si deja traite', async () => {
    const confirmerMock = jest.fn().mockResolvedValue(undefined);
    const webhookRepo = {
      ...webhookRepoBase,
      findOne: jest.fn().mockResolvedValue({ id: 1, evenement: 'transaction.approved', idFedapayRef: '12345', traite: true }),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const svc = await buildWebhookService({
      webhookRepo,
      txService: { confirmer: confirmerMock, echouer: jest.fn() },
    });

    const corps = Buffer.from(JSON.stringify({ event: 'transaction.approved', id: 12345 }));
    const resultat = await svc.traiter(corps, 'sig');

    expect(resultat.recu).toBe(true);
    expect(confirmerMock).not.toHaveBeenCalled();
  });

  it('4. Webhook signature invalide : rejete, rien en base', async () => {
    const fauxx = new FedapayClientFaux();
    fauxx.definirSignatureValide(false);

    const webhookRepo = {
      ...webhookRepoBase,
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn(),
      save: jest.fn(),
      update: jest.fn(),
    };

    const svc = await buildWebhookService({ webhookRepo, fedapay: fauxx });

    const corps = Buffer.from(JSON.stringify({ event: 'transaction.approved', id: 12345 }));
    await expect(svc.traiter(corps, 'mauvaise_signature')).rejects.toThrow(
      UnauthorizedException,
    );

    expect(webhookRepo.save).not.toHaveBeenCalled();
  });

  it('5. Webhook echec : echouer() appele, confirmer() non', async () => {
    const confirmerMock = jest.fn().mockResolvedValue(undefined);
    const echouerMock = jest.fn().mockResolvedValue(undefined);

    const txInterne = fabriqueTransaction({ idFedapay: '12345', statut: StatutTransaction.EN_ATTENTE });
    const webhookSauvegarde = { id: 10, evenement: 'transaction.declined', traite: false };

    const webhookRepo = {
      ...webhookRepoBase,
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue(webhookSauvegarde),
      save: jest.fn().mockImplementation(async (w: unknown) => w),
      update: jest.fn(),
    };

    const txRepo = {
      findOne: jest.fn().mockResolvedValue(txInterne),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb: (m: unknown) => unknown) => {
          const mgr = {
            getRepository: (entity: { name: string }) => {
              if (entity.name === Transaction.name) {
                return { findOne: jest.fn().mockResolvedValue(txInterne) };
              }
              if (entity.name === WebhookFedapay.name) {
                return { update: jest.fn() };
              }
              return {};
            },
          };
          return cb(mgr);
        }),
      },
    };

    const svc = await buildWebhookService({
      webhookRepo,
      txRepo,
      txService: { confirmer: confirmerMock, echouer: echouerMock },
    });

    const corps = Buffer.from(JSON.stringify({ event: 'transaction.declined', id: 12345 }));
    const resultat = await svc.traiter(corps, 'sig');

    expect(resultat.recu).toBe(true);
    expect(echouerMock).toHaveBeenCalled();
    expect(confirmerMock).not.toHaveBeenCalled();
  });

  it('6. Double-clic via webhook : confirmer() appele une seule fois (idempotence statut)', async () => {
    // La transaction est deja REUSSI : idempotence via statut
    const txDejaReussie = fabriqueTransaction({
      idFedapay: '12345',
      statut: StatutTransaction.REUSSI,
    });
    const confirmerMock = jest.fn().mockResolvedValue(undefined);

    const webhookRepo = {
      ...webhookRepoBase,
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockReturnValue({ id: 11, evenement: 'transaction.approved', traite: false }),
      save: jest.fn().mockImplementation(async (w: unknown) => w),
      update: jest.fn(),
    };

    const txRepo = {
      findOne: jest.fn().mockResolvedValue(txDejaReussie),
      manager: {
        transaction: jest.fn().mockImplementation(async (cb: (m: unknown) => unknown) => {
          const mgr = {
            getRepository: (entity: { name: string }) => {
              if (entity.name === Transaction.name) {
                return { findOne: jest.fn().mockResolvedValue(txDejaReussie) };
              }
              if (entity.name === WebhookFedapay.name) {
                return { update: jest.fn() };
              }
              return {};
            },
          };
          return cb(mgr);
        }),
      },
    };

    const svc = await buildWebhookService({
      webhookRepo,
      txRepo,
      txService: { confirmer: confirmerMock, echouer: jest.fn() },
    });

    const corps = Buffer.from(JSON.stringify({ event: 'transaction.approved', id: 12345 }));
    await svc.traiter(corps, 'sig');

    // confirmer ne doit pas etre rappele
    expect(confirmerMock).not.toHaveBeenCalled();
  });
});
