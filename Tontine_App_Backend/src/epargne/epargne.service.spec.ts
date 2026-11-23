/**
 * Tests unitaires d'EpargneService (création + dépôt initial, dépôt
 * additionnel, lecture avec aperçu) et de TransactionService.confirmerDepotEpargne().
 *
 * Stratégie :
 * - FedapayClientFaux (aucun appel réseau).
 * - Mocks manuels des Repository TypeORM (tokens `${Entity.name}Repository`).
 */

import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EpargneService } from './epargne.service';
import { TransactionService } from '../transaction/transaction.service';
import { FedapayClientFaux } from '../fedapay/fedapay-client.faux';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import { NotificationService } from '../notification/notification.service';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { Epargne } from './entities/epargne.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import {
  SensEcriture,
  StatutEpargne,
  StatutTransaction,
  TypeEcriture,
  TypeTransaction,
} from '../common/enums';

// ─── Tokens TypeORM ───────────────────────────────────────────────────────────
const EPARGNE_REPO = `${Epargne.name}Repository`;
const TX_REPO = `${Transaction.name}Repository`;
const MEMBRE_REPO = `${Membre.name}Repository`;

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
    montant: 0,
    dateEcheance: '2099-12-31',
    statut: StatutEpargne.ACTIVE,
    membre: fabriqueMembre(),
    ...overrides,
  });
}

// ─── EpargneService ───────────────────────────────────────────────────────────
describe('EpargneService', () => {
  let service: EpargneService;
  let fedapayFaux: FedapayClientFaux;
  let epargneRepoMock: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
  };
  let txRepoMock: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
  };
  let membreRepoMock: { findOneBy: jest.Mock };
  let parametresMock: { getNumber: jest.Mock };

  beforeEach(async () => {
    fedapayFaux = new FedapayClientFaux();
    fedapayFaux.definirStatut('pending');
    fedapayFaux.definirFees(0);
    epargneRepoMock = {
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation(async (e: Epargne) => ({
        ...e,
        id: 1,
      })),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
    };
    txRepoMock = {
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation(async (t: Transaction) => ({
        ...t,
        id: 100,
      })),
      find: jest.fn().mockResolvedValue([]),
    };
    membreRepoMock = {
      findOneBy: jest.fn().mockResolvedValue(fabriqueMembre()),
    };
    parametresMock = {
      getNumber: jest.fn().mockImplementation((cle: string) => {
        const vals: Record<string, number> = {
          epargne_minimale: 1,
          pourcentage_frais_fedapay: 0,
          penalite_epargne_anticipee: 5,
          retenue_epargne_echeance: 2.75,
          pourcentage_frais_retrait: 0,
        };
        return Promise.resolve(vals[cle] ?? 0);
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EpargneService,
        { provide: EPARGNE_REPO, useValue: epargneRepoMock },
        { provide: TX_REPO, useValue: txRepoMock },
        { provide: MEMBRE_REPO, useValue: membreRepoMock },
        { provide: FEDAPAY_CLIENT, useValue: fedapayFaux },
        { provide: ParametreSystemeService, useValue: parametresMock },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue({ appPublicUrl: 'https://ex.com' }),
          },
        },
      ],
    }).compile();
    service = module.get<EpargneService>(EpargneService);
  });

  // ─── Création + dépôt initial ─────────────────────────────────────────────
  it('crée l\'épargne (montant 0, active) et le dépôt initial, renvoie urlPaiement', async () => {
    const { epargne, transaction, urlPaiement } = await service.creer(1, {
      montantInitial: 5000,
      dateEcheance: '2099-12-31',
    });
    expect(epargne.montant).toBe(0); // non crédité tant que le dépôt n'est pas confirmé
    expect(epargne.statut).toBe(StatutEpargne.ACTIVE);
    expect(epargne.dateEcheance).toBe('2099-12-31');
    expect(transaction.type).toBe(TypeTransaction.DEPOT);
    expect(transaction.statut).toBe(StatutTransaction.EN_ATTENTE);
    expect(transaction.montant).toBe(5000); // frais = 0
    expect(transaction.epargne).toMatchObject({ id: 1 });
    expect(urlPaiement).toContain('fedapay.com');
    expect(epargneRepoMock.save).toHaveBeenCalledTimes(1);
  });

  it('rejette une date d\'échéance dans le passé (400)', async () => {
    await expect(
      service.creer(1, { montantInitial: 5000, dateEcheance: '2000-01-01' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejette un montant inférieur au minimum (400)', async () => {
    parametresMock.getNumber.mockImplementationOnce(async () => 100);
    await expect(
      service.creer(1, { montantInitial: 50, dateEcheance: '2099-12-31' }),
    ).rejects.toThrow(BadRequestException);
  });

  it('si FedaPay échoue : transaction ECHOUE + ServiceUnavailable (épargne reste à 0)', async () => {
    jest
      .spyOn(fedapayFaux, 'creerTransaction')
      .mockRejectedValue(new Error('Réseau KO'));
    const saved: Transaction[] = [];
    txRepoMock.save = jest.fn().mockImplementation(async (t: Transaction) => {
      const out = { ...t, id: 100 } as Transaction;
      saved.push(out);
      return out;
    });
    await expect(
      service.creer(1, { montantInitial: 5000, dateEcheance: '2099-12-31' }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(saved.some((t) => t.statut === StatutTransaction.ECHOUE)).toBe(true);
  });

  it('anti double-clic : renvoie la transaction existante (< 10 min, même échéance)', async () => {
    const existante = Object.assign(new Transaction(), {
      id: 77,
      type: TypeTransaction.DEPOT,
      montant: 5000,
      statut: StatutTransaction.EN_ATTENTE,
      dateOperation: new Date(),
      epargne: fabriqueEpargne({ id: 3, dateEcheance: '2099-12-31' }),
    });
    txRepoMock.find.mockResolvedValue([existante]);
    const { transaction, urlPaiement } = await service.creer(1, {
      montantInitial: 5000,
      dateEcheance: '2099-12-31',
    });
    expect(transaction.id).toBe(77);
    expect(urlPaiement).toBeNull();
    expect(epargneRepoMock.save).not.toHaveBeenCalled(); // aucune nouvelle épargne
  });

  // ─── Dépôt additionnel ────────────────────────────────────────────────────
  it('ajoute un dépôt à une épargne active', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ id: 5, montant: 3000, statut: StatutEpargne.ACTIVE }),
    );
    const { transaction, urlPaiement } = await service.ajouterDepot(1, 5, {
      montant: 2000,
    });
    expect(transaction.type).toBe(TypeTransaction.DEPOT);
    expect(transaction.montant).toBe(2000);
    expect(transaction.epargne).toMatchObject({ id: 5 });
    expect(urlPaiement).toContain('fedapay.com');
  });

  it('rejette l\'ajout sur une épargne introuvable (404)', async () => {
    epargneRepoMock.findOne.mockResolvedValue(null);
    await expect(service.ajouterDepot(1, 99, { montant: 100 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejette l\'ajout sur une épargne d\'un autre membre (404)', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ membre: fabriqueMembre({ id: 2 }) }),
    );
    await expect(service.ajouterDepot(1, 1, { montant: 100 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('rejette l\'ajout sur une épargne non active (422)', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ statut: StatutEpargne.RETIREE }),
    );
    await expect(service.ajouterDepot(1, 1, { montant: 100 })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  // ─── Lecture + aperçu ─────────────────────────────────────────────────────
  it('findOne 404 si l\'épargne n\'appartient pas au membre', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ membre: fabriqueMembre({ id: 2 }) }),
    );
    await expect(service.findOne(1, 1)).rejects.toThrow(NotFoundException);
  });

  it('aperçu : taux 5 % avant l\'échéance, 2,75 % à ou après', async () => {
    // Avant échéance (dateEcheance future) → 5 %.
    epargneRepoMock.findOne.mockResolvedValueOnce(
      fabriqueEpargne({ id: 1, montant: 10000, dateEcheance: '2099-12-31' }),
    );
    const vueAvant = await service.findOne(1, 1);
    expect(vueAvant.apercu.tauxApplicable).toBe(5);
    expect(vueAvant.apercu.penaliteSiRetraitMaintenant).toBe(500);
    expect(vueAvant.apercu.netEstime).toBe(9500);

    // À/après échéance (date passée) → 2,75 %.
    epargneRepoMock.findOne.mockResolvedValueOnce(
      fabriqueEpargne({ id: 1, montant: 10000, dateEcheance: '2000-01-01' }),
    );
    const vueApres = await service.findOne(1, 1);
    expect(vueApres.apercu.tauxApplicable).toBe(2.75);
    expect(vueApres.apercu.penaliteSiRetraitMaintenant).toBe(275);
    expect(vueApres.apercu.netEstime).toBe(9725);
  });

  it('findAll renvoie les épargnes du membre avec aperçu', async () => {
    epargneRepoMock.find.mockResolvedValue([
      fabriqueEpargne({ id: 1, montant: 2000 }),
      fabriqueEpargne({ id: 2, montant: 8000 }),
    ]);
    const vues = await service.findAll(1);
    expect(vues).toHaveLength(2);
    expect(vues[0].apercu).toBeDefined();
    expect(vues[0].apercu.tauxApplicable).toBe(5); // échéance future
  });
});

// ─── TransactionService.confirmerDepotEpargne ─────────────────────────────────
describe('TransactionService.confirmerDepotEpargne', () => {
  let transactionService: TransactionService;
  let fedapayFaux: FedapayClientFaux;

  beforeEach(async () => {
    fedapayFaux = new FedapayClientFaux();
    fedapayFaux.definirFees(0);
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionService,
        {
          provide: `${Transaction.name}Repository`,
          useValue: {
            findOne: jest.fn(),
            save: jest.fn().mockImplementation(async (t: Transaction) => t),
          },
        },
        { provide: FEDAPAY_CLIENT, useValue: fedapayFaux },
        {
          provide: NotificationService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();
    transactionService = module.get<TransactionService>(TransactionService);
  });

  function fabriqueTransaction(
    overrides: Partial<Transaction> = {},
  ): Transaction {
    return Object.assign(new Transaction(), {
      id: 1,
      type: TypeTransaction.DEPOT,
      montant: 5000,
      fraisFedapay: 0,
      referenceUnique: 'TX-1-20250101-abcd1234',
      idFedapay: '12345',
      statut: StatutTransaction.EN_ATTENTE,
      joursCibles: null,
      membre: { id: 1 },
      epargne: {
        id: 1,
        montant: 0,
        dateEcheance: '2099-12-31',
        statut: StatutEpargne.ACTIVE,
      } as Epargne,
      ...overrides,
    });
  }

  function fabriqueManager(tx: Transaction) {
    const ecritures: EcritureComptable[] = [];
    const epargnesMaj: Epargne[] = [];
    const portefeuilleMaj: Partial<Portefeuille>[] = [];
    const sum = (pred: (e: EcritureComptable) => boolean) =>
      ecritures.filter(pred).reduce((s, e) => s + e.montant, 0);
    const recalculQb = {
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getRawOne: jest.fn().mockImplementation(() =>
        Promise.resolve({
          coti_credit: String(
            sum(
              (e) =>
                e.type === TypeEcriture.COTISATION &&
                e.sens === SensEcriture.CREDIT,
            ),
          ),
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
    const epargneRepoMock = {
      findOne: jest.fn().mockResolvedValue(
        Object.assign(new Epargne(), {
          id: 1,
          montant: 0, // démarre à 0 (aucun dépôt encore confirmé)
          dateEcheance: '2099-12-31',
          statut: StatutEpargne.ACTIVE,
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
      if (name === 'Epargne') return epargneRepoMock;
      if (name === 'Portefeuille') return portefeuilleRepoMock;
      return {};
    });
    return {
      getRepository,
      _ecritures: ecritures,
      _epargnesMaj: epargnesMaj,
      _portefeuilleMaj: portefeuilleMaj,
    };
  }

  it('dépôt réussi : écriture EPARGNE crédit, sans cycle, epargne.montant augmente', async () => {
    const tx = fabriqueTransaction({ montant: 5000, fraisFedapay: 0 });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const ecr = manager._ecritures.find((e) => e.type === TypeEcriture.EPARGNE);
    expect(ecr).toBeDefined();
    // montant épargné = total payé (5000) - frais (0) = 5000.
    expect(ecr!.montant).toBe(5000);
    expect(ecr!.sens).toBe(SensEcriture.CREDIT);
    expect(ecr!.cycle).toBeNull(); // aucune écriture d'épargne dans un cycle
    // Epargne.montant augmenté de 5000.
    expect(manager._epargnesMaj[0].montant).toBe(5000);
  });

  it('portefeuille recalculé : soldeEpargne = montant du dépôt, retirable inchangé', async () => {
    const tx = fabriqueTransaction({ montant: 5000 });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    expect(manager._portefeuilleMaj).toHaveLength(1);
    expect(manager._portefeuilleMaj[0].soldeEpargne).toBe(5000);
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
});
