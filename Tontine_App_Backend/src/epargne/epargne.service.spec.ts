/**
 * Tests unitaires d'EpargneService (création + dépôt initial, dépôt
 * additionnel, lecture avec aperçu) et de TransactionService.confirmerDepotEpargne().
 *
 * Stratégie :
 * - FedapayClientFaux (aucun appel réseau).
 * - Mocks manuels des Repository TypeORM (tokens `${Entity.name}Repository`).
 *
 * Depuis le prompt 7b :
 * - dateEcheance n'est plus demandée (ignorée si envoyée).
 * - objectifMontant est obligatoire.
 * - Les tests basés sur la date (échéance passée/future, bascule du taux à
 *   23h30) sont retirés ou adaptés : le taux dépend désormais de l'objectif.
 */

import {
  BadRequestException,
  ConflictException,
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
import { WebhookFedapayService } from '../webhook-fedapay/webhook-fedapay.service';
import { WebhookFedapay } from '../webhook-fedapay/entities/webhook-fedapay.entity';
import {
  SensEcriture,
  StatutEpargne,
  StatutTransaction,
  TypeEcriture,
  TypeTransaction,
} from '../common/enums';
import { validateSync } from 'class-validator';
import { plainToClass } from 'class-transformer';
import { CreateEpargneDto } from './dto/create-epargne.dto';

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
    dateEcheance: null,
    statut: StatutEpargne.ACTIVE,
    nom: 'Mon projet',
    objectifMontant: 10000,
    objectifAtteintLe: null,
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

  it('création sans dateEcheance : OK (ignorée silencieusement)', async () => {
    const { epargne, transaction, urlPaiement } = await service.creer(1, {
      montantInitial: 5000,
      nom: 'Achat moto',
      objectifMontant: 50000,
    });
    expect(epargne.montant).toBe(0);
    expect(epargne.statut).toBe(StatutEpargne.ACTIVE);
    expect(epargne.dateEcheance).toBeNull();
    expect(epargne.nom).toBe('Achat moto');
    expect(epargne.objectifMontant).toBe(50000);
    expect(epargne.progressionPourcent).toBe(0);
    expect(transaction.type).toBe(TypeTransaction.DEPOT);
    expect(transaction.statut).toBe(StatutTransaction.EN_ATTENTE);
    expect(transaction.montant).toBe(5000);
    expect(transaction.epargne).toMatchObject({ id: 1 });
    expect(urlPaiement).toContain('fedapay.com');
    expect(epargneRepoMock.save).toHaveBeenCalledTimes(1);
  });

  it('création avec dateEcheance envoyée : ignorée sans erreur', async () => {
    // dateEcheance est @IsOptional() et ignorée côté service.
    const { epargne } = await service.creer(1, {
      montantInitial: 5000,
      nom: 'Test',
      objectifMontant: 10000,
      dateEcheance: '2000-01-01', // passé → ne doit pas lever d'erreur
    });
    expect(epargne.dateEcheance).toBeNull();
  });

  it('création sans objectifMontant → refusé par le DTO (class-validator)', () => {
    const dto = plainToClass(CreateEpargneDto, {
      montantInitial: 5000,
      nom: 'Test',
      // objectifMontant absent
    });
    const errors = validateSync(dto);
    const objectifErrors = errors.filter(
      (e) => e.property === 'objectifMontant',
    );
    expect(objectifErrors.length).toBeGreaterThan(0);
  });

  it('objectif 1 accepté par le DTO', () => {
    const dto = plainToClass(CreateEpargneDto, {
      montantInitial: 1,
      nom: 'Test minimum',
      objectifMontant: 1,
    });
    const errors = validateSync(dto);
    expect(errors).toHaveLength(0);
  });

  it('objectif 0 refusé par le DTO (Min 1)', () => {
    const dto = plainToClass(CreateEpargneDto, {
      montantInitial: 5000,
      nom: 'Test',
      objectifMontant: 0,
    });
    const errors = validateSync(dto);
    const objectifErrors = errors.filter(
      (e) => e.property === 'objectifMontant',
    );
    expect(objectifErrors.length).toBeGreaterThan(0);
  });

  it('objectif négatif refusé par le DTO', () => {
    const dto = plainToClass(CreateEpargneDto, {
      montantInitial: 5000,
      nom: 'Test',
      objectifMontant: -100,
    });
    const errors = validateSync(dto);
    const objectifErrors = errors.filter(
      (e) => e.property === 'objectifMontant',
    );
    expect(objectifErrors.length).toBeGreaterThan(0);
  });

  it('rejette un montant inférieur au minimum (400)', async () => {
    parametresMock.getNumber.mockImplementationOnce(async () => 100);
    await expect(
      service.creer(1, {
        montantInitial: 50,
        nom: 'Test',
        objectifMontant: 10000,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('si FedaPay échoue : transaction ECHOUE + ServiceUnavailable (épargne reste à 0)', async () => {
    jest
      .spyOn(fedapayFaux, 'creerTransaction')
      .mockRejectedValue(new Error('Réseau KO'));
    const saved: Transaction[] = [];
    txRepoMock.save = jest.fn().mockImplementation(async (t: Transaction) => {
      const out = { ...t, id: 100 };
      saved.push(out);
      return out;
    });
    await expect(
      service.creer(1, {
        montantInitial: 5000,
        nom: 'Test',
        objectifMontant: 10000,
      }),
    ).rejects.toThrow(ServiceUnavailableException);
    expect(saved.some((t) => t.statut === StatutTransaction.ECHOUE)).toBe(true);
  });

  it('anti double-clic : renvoie la transaction existante (< 10 min, même objectif)', async () => {
    const existante = Object.assign(new Transaction(), {
      id: 77,
      type: TypeTransaction.DEPOT,
      montant: 5000,
      statut: StatutTransaction.EN_ATTENTE,
      dateOperation: new Date(),
      epargne: fabriqueEpargne({ id: 3, objectifMontant: 50000 }),
    });
    txRepoMock.find.mockResolvedValue([existante]);
    const { transaction, urlPaiement } = await service.creer(1, {
      montantInitial: 5000,
      nom: 'Test',
      objectifMontant: 50000,
    });
    expect(transaction.id).toBe(77);
    expect(urlPaiement).toBeNull();
    expect(epargneRepoMock.save).not.toHaveBeenCalled();
  });

  // ─── Dépôt additionnel ────────────────────────────────────────────────────

  it('ajoute un dépôt à une épargne active', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({
        id: 5,
        montant: 3000,
        statut: StatutEpargne.ACTIVE,
        objectifMontant: 10000,
      }),
    );
    const { transaction, urlPaiement } = await service.ajouterDepot(1, 5, {
      montant: 2000,
    });
    expect(transaction.type).toBe(TypeTransaction.DEPOT);
    expect(transaction.montant).toBe(2000);
    expect(transaction.epargne).toMatchObject({ id: 5 });
    expect(urlPaiement).toContain('fedapay.com');
  });

  it("rejette l'ajout sur une épargne introuvable (404)", async () => {
    epargneRepoMock.findOne.mockResolvedValue(null);
    await expect(service.ajouterDepot(1, 99, { montant: 100 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("rejette l'ajout sur une épargne d'un autre membre (404)", async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ membre: fabriqueMembre({ id: 2 }) }),
    );
    await expect(service.ajouterDepot(1, 1, { montant: 100 })).rejects.toThrow(
      NotFoundException,
    );
  });

  it("rejette l'ajout sur une épargne non active (422)", async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ statut: StatutEpargne.RETIREE }),
    );
    await expect(service.ajouterDepot(1, 1, { montant: 100 })).rejects.toThrow(
      UnprocessableEntityException,
    );
  });

  // ─── Lecture + aperçu ─────────────────────────────────────────────────────

  it("findOne 404 si l'épargne n'appartient pas au membre", async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ membre: fabriqueMembre({ id: 2 }) }),
    );
    await expect(service.findOne(1, 1)).rejects.toThrow(NotFoundException);
  });

  it('aperçu objectif non atteint : taux 5 %', async () => {
    // montant 5000 < objectif 10000 → pénalité 5 %
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({
        id: 1,
        montant: 5000,
        objectifMontant: 10000,
        objectifAtteintLe: null,
      }),
    );
    const vue = await service.findOne(1, 1);
    expect(vue.apercu.tauxApplicable).toBe(5);
    expect(vue.apercu.penaliteSiRetraitMaintenant).toBe(250); // ceil(5000 * 5 / 100)
    expect(vue.apercu.netEstime).toBe(4750);
    expect(vue.apercu.objectifAtteint).toBe(false);
    expect(vue.apercu.resteAAtteindre).toBe(5000);
  });

  it('aperçu objectif atteint (montant exactement = objectif) : taux 2,75 %', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({
        id: 1,
        montant: 10000,
        objectifMontant: 10000,
        objectifAtteintLe: null,
      }),
    );
    const vue = await service.findOne(1, 1);
    expect(vue.apercu.tauxApplicable).toBe(2.75);
    expect(vue.apercu.penaliteSiRetraitMaintenant).toBe(275);
    expect(vue.apercu.netEstime).toBe(9725);
    expect(vue.apercu.objectifAtteint).toBe(true);
    expect(vue.apercu.resteAAtteindre).toBe(0);
  });

  it('aperçu objectif acquis (objectifAtteintLe non null) : taux 2,75 % même si montant < objectif', async () => {
    // Après un retrait partiel, le montant est retombé sous l'objectif, mais
    // objectifAtteintLe est renseigné → l'objectif reste acquis.
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({
        id: 1,
        montant: 3000,
        objectifMontant: 10000,
        objectifAtteintLe: new Date('2026-01-01T12:00:00Z'),
      }),
    );
    const vue = await service.findOne(1, 1);
    expect(vue.apercu.tauxApplicable).toBe(2.75);
    expect(vue.apercu.objectifAtteint).toBe(true);
    // resteAAtteindre = max(0, objectif - montant) = max(0, 10000 - 3000) = 7000
    // (c'est un indicateur de progression, pas une condition de taux)
    expect(vue.apercu.resteAAtteindre).toBe(7000);
  });

  it('findAll renvoie les épargnes du membre avec aperçu', async () => {
    epargneRepoMock.find.mockResolvedValue([
      fabriqueEpargne({ id: 1, montant: 2000, objectifMontant: 10000 }),
      fabriqueEpargne({ id: 2, montant: 8000, objectifMontant: 10000 }),
    ]);
    const vues = await service.findAll(1);
    expect(vues).toHaveLength(2);
    expect(vues[0].apercu).toBeDefined();
    expect(vues[0].apercu.objectifAtteint).toBe(false);
    expect(vues[1].apercu.objectifAtteint).toBe(false); // 8000 < 10000
  });

  // ─── resteAAtteindre ──────────────────────────────────────────────────────

  it('resteAAtteindre = 0 quand montant >= objectif', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ id: 1, montant: 15000, objectifMontant: 10000 }),
    );
    const vue = await service.findOne(1, 1);
    expect(vue.apercu.resteAAtteindre).toBe(0);
  });

  it('resteAAtteindre = objectif - montant quand montant < objectif', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ id: 1, montant: 3000, objectifMontant: 10000 }),
    );
    const vue = await service.findOne(1, 1);
    expect(vue.apercu.resteAAtteindre).toBe(7000);
  });

  // ─── Frais FedaPay ≠ 0 ───────────────────────────────────────────────────

  it('avec frais 2 % : transaction montant = 5100, epargne.id liée, fraisFedapay = 100', async () => {
    parametresMock.getNumber.mockImplementation((cle: string) => {
      const vals: Record<string, number> = {
        epargne_minimale: 1,
        pourcentage_frais_fedapay: 2,
        penalite_epargne_anticipee: 5,
        retenue_epargne_echeance: 2.75,
        pourcentage_frais_retrait: 0,
      };
      return Promise.resolve(vals[cle] ?? 0);
    });

    const { transaction } = await service.creer(1, {
      montantInitial: 5000,
      nom: 'Test frais',
      objectifMontant: 10000,
    });
    expect(transaction.montant).toBe(5100);
    expect(transaction.fraisFedapay).toBe(100);
    expect(transaction.epargne).toMatchObject({ id: 1 });
  });

  // ─── Anti double-clic dépôt additionnel ──────────────────────────────────

  it('anti double-clic dépôt additionnel : renvoie la transaction existante', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ id: 5, montant: 3000, statut: StatutEpargne.ACTIVE }),
    );
    const existante = Object.assign(new Transaction(), {
      id: 88,
      type: TypeTransaction.DEPOT,
      montant: 2000,
      statut: StatutTransaction.EN_ATTENTE,
      dateOperation: new Date(),
      epargne: fabriqueEpargne({ id: 5 }),
    });
    txRepoMock.find.mockResolvedValue([existante]);
    const { transaction, urlPaiement } = await service.ajouterDepot(1, 5, {
      montant: 2000,
    });
    expect(transaction.id).toBe(88);
    expect(urlPaiement).toBeNull();
    expect(txRepoMock.create).not.toHaveBeenCalled();
  });

  // ─── progressionPourcent ─────────────────────────────────────────────────

  it('progression 0 % (montant 0, objectif 10000)', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ id: 1, montant: 0, objectifMontant: 10000 }),
    );
    const vue = await service.findOne(1, 1);
    expect(vue.progressionPourcent).toBe(0);
  });

  it('progression 50 % (montant 5000, objectif 10000)', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ id: 1, montant: 5000, objectifMontant: 10000 }),
    );
    const vue = await service.findOne(1, 1);
    expect(vue.progressionPourcent).toBe(50);
  });

  it('progression 100 % (montant 10000, objectif 10000)', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ id: 1, montant: 10000, objectifMontant: 10000 }),
    );
    const vue = await service.findOne(1, 1);
    expect(vue.progressionPourcent).toBe(100);
  });

  it('progression plafonnée à 100 % (montant 15000, objectif 10000)', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ id: 1, montant: 15000, objectifMontant: 10000 }),
    );
    const vue = await service.findOne(1, 1);
    expect(vue.progressionPourcent).toBe(100);
  });

  it("progression arrondie à l'inférieur (montant 7501, objectif 10000 → 75 %)", async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ id: 1, montant: 7501, objectifMontant: 10000 }),
    );
    const vue = await service.findOne(1, 1);
    expect(vue.progressionPourcent).toBe(75);
  });

  // ─── PATCH /epargnes/:id ───────────────────────────────────────────────────

  it('PATCH : modifier le nom avant tout dépôt → OK', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({
        id: 1,
        montant: 0,
        statut: StatutEpargne.ACTIVE,
        nom: 'Ancien nom',
        objectifMontant: 10000,
        objectifAtteintLe: null,
      }),
    );
    epargneRepoMock.save.mockImplementation(async (e: Epargne) => e);

    const vue = await service.modifier(1, 1, { nom: 'Nouveau nom' });
    expect(vue.nom).toBe('Nouveau nom');
    expect(vue.objectifMontant).toBe(10000);
  });

  it("PATCH : modifier l'objectif avant tout dépôt (montant 0) → OK", async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({
        id: 1,
        montant: 0,
        statut: StatutEpargne.ACTIVE,
        nom: 'Mon projet',
        objectifMontant: 10000,
        objectifAtteintLe: null,
      }),
    );
    epargneRepoMock.save.mockImplementation(async (e: Epargne) => e);

    const vue = await service.modifier(1, 1, { objectifMontant: 20000 });
    expect(vue.objectifMontant).toBe(20000);
  });

  it("PATCH : modifier l'objectif après un dépôt réussi (montant > 0) → 409", async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({
        id: 1,
        montant: 3000, // dépôt réussi
        statut: StatutEpargne.ACTIVE,
        nom: 'Mon projet',
        objectifMontant: 10000,
        objectifAtteintLe: null,
      }),
    );
    await expect(
      service.modifier(1, 1, { objectifMontant: 20000 }),
    ).rejects.toThrow(ConflictException);
  });

  it("PATCH : modifier l'objectif après que l'objectif a été atteint (objectifAtteintLe non null) → 409", async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({
        id: 1,
        montant: 0, // montant retombé à 0 mais objectifAtteintLe est renseigné
        statut: StatutEpargne.ACTIVE,
        nom: 'Mon projet',
        objectifMontant: 10000,
        objectifAtteintLe: new Date('2026-01-01'),
      }),
    );
    await expect(
      service.modifier(1, 1, { objectifMontant: 20000 }),
    ).rejects.toThrow(ConflictException);
  });

  it('PATCH : modifier uniquement le nom est toujours possible après un dépôt', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({
        id: 1,
        montant: 3000, // dépôt réussi
        statut: StatutEpargne.ACTIVE,
        nom: 'Mon projet',
        objectifMontant: 10000,
      }),
    );
    epargneRepoMock.save.mockImplementation(async (e: Epargne) => e);

    const vue = await service.modifier(1, 1, { nom: 'Nouveau nom' });
    expect(vue.nom).toBe('Nouveau nom');
    expect(vue.objectifMontant).toBe(10000); // inchangé
  });

  it("PATCH sur une épargne d'un autre membre → 404", async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({ id: 1, membre: fabriqueMembre({ id: 2 }) }),
    );
    await expect(service.modifier(1, 1, { nom: 'Hack' })).rejects.toThrow(
      NotFoundException,
    );
  });

  it('PATCH sur une épargne retirée → 409', async () => {
    epargneRepoMock.findOne.mockResolvedValue(
      fabriqueEpargne({
        id: 1,
        statut: StatutEpargne.RETIREE,
        membre: fabriqueMembre({ id: 1 }),
      }),
    );
    await expect(service.modifier(1, 1, { nom: 'Test' })).rejects.toThrow(
      ConflictException,
    );
  });

  // ─── Nom court refusé par le DTO ──────────────────────────────────────────

  it('nom trop court (< 2) refusé par le DTO', () => {
    const dto = plainToClass(CreateEpargneDto, {
      montantInitial: 5000,
      nom: 'A',
      objectifMontant: 10000,
    });
    const errors = validateSync(dto);
    const nomErrors = errors.filter((e) => e.property === 'nom');
    expect(nomErrors.length).toBeGreaterThan(0);
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
        dateEcheance: null,
        statut: StatutEpargne.ACTIVE,
        objectifMontant: 10000,
        objectifAtteintLe: null,
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
    // Épargne de départ : montant 0, objectif 10000, pas encore atteint.
    const epargneDepart: Epargne = Object.assign(new Epargne(), {
      id: 1,
      montant: 0,
      dateEcheance: null,
      statut: StatutEpargne.ACTIVE,
      objectifMontant: 10000,
      objectifAtteintLe: null,
    });
    const epargneRepoMock = {
      findOne: jest.fn().mockResolvedValue(epargneDepart),
      save: jest.fn().mockImplementation(async (e: Epargne) => {
        // Mettre à jour l'épargne de départ en mémoire pour les prochains appels.
        Object.assign(epargneDepart, e);
        epargnesMaj.push({ ...e } as Epargne);
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
      _epargneDepart: epargneDepart,
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
    expect(ecr!.montant).toBe(5000);
    expect(ecr!.sens).toBe(SensEcriture.CREDIT);
    expect(ecr!.cycle).toBeNull();
    expect(manager._epargnesMaj[0].montant).toBe(5000);
  });

  it('portefeuille recalculé : soldeEpargne = montant du dépôt', async () => {
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

  it("objectifAtteintLe renseigné quand montant atteint exactement l'objectif", async () => {
    // dépôt de 10000 sur une épargne à 0, objectif = 10000.
    const tx = fabriqueTransaction({ montant: 10000, fraisFedapay: 0 });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const epargneMaj = manager._epargnesMaj[0];
    expect(epargneMaj.montant).toBe(10000);
    expect(epargneMaj.objectifAtteintLe).toBeInstanceOf(Date);
  });

  it("objectifAtteintLe renseigné quand montant dépasse l'objectif", async () => {
    const tx = fabriqueTransaction({ montant: 15000, fraisFedapay: 0 });
    // Épargne départ : objectif 10000.
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    expect(manager._epargnesMaj[0].objectifAtteintLe).toBeInstanceOf(Date);
  });

  it('objectifAtteintLe non renseigné si montant < objectif', async () => {
    // dépôt de 5000, objectif 10000.
    const tx = fabriqueTransaction({ montant: 5000, fraisFedapay: 0 });
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    expect(manager._epargnesMaj[0].objectifAtteintLe).toBeNull();
  });

  it('objectifAtteintLe déjà renseigné : ne pas le réécrire au dépôt suivant', async () => {
    // L'objectif a déjà été atteint lors d'un dépôt précédent.
    const dateDejaAtteinte = new Date('2026-01-01T12:00:00Z');
    const tx = fabriqueTransaction({ montant: 5000, fraisFedapay: 0 });
    const manager = fabriqueManager(tx);
    // Pré-renseigner objectifAtteintLe sur l'épargne de départ.
    manager._epargneDepart.objectifAtteintLe = dateDejaAtteinte;
    manager._epargneDepart.montant = 8000; // déjà au-dessus de la moitié

    // Reconfigurer le mock findOne pour renvoyer cet état.
    (
      manager.getRepository({ name: 'Epargne' } as never) as {
        findOne: jest.Mock;
      }
    ).findOne.mockResolvedValue({ ...manager._epargneDepart });

    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    // objectifAtteintLe ne doit pas avoir changé.
    expect(manager._epargnesMaj[0].objectifAtteintLe).toEqual(dateDejaAtteinte);
  });

  it('objectifAtteintLe reste acquis après un retrait partiel : le dépôt suivant ne le réinitialise pas', async () => {
    // Scénario : objectif atteint, puis retrait partiel ramène le montant sous
    // l'objectif, puis nouveau dépôt → objectifAtteintLe doit rester acquis.
    const dateAtteinte = new Date('2026-03-01T10:00:00Z');
    const tx = fabriqueTransaction({ montant: 2000, fraisFedapay: 0 });
    const manager = fabriqueManager(tx);
    // Épargne après retrait partiel : montant 3000, objectifAtteintLe déjà renseigné.
    manager._epargneDepart.montant = 3000;
    manager._epargneDepart.objectifAtteintLe = dateAtteinte;
    (
      manager.getRepository({ name: 'Epargne' } as never) as {
        findOne: jest.Mock;
      }
    ).findOne.mockResolvedValue({ ...manager._epargneDepart });

    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    expect(manager._epargnesMaj[0].objectifAtteintLe).toEqual(dateAtteinte);
    expect(manager._epargnesMaj[0].montant).toBe(5000); // 3000 + 2000
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

  // ─── Frais FedaPay ≠ 0 ───────────────────────────────────────────────────

  it('frais réels FedaPay ≠ frais estimés : épargne crédite le montant estimé', async () => {
    const tx = fabriqueTransaction({ montant: 5100, fraisFedapay: 100 });
    fedapayFaux.definirFees(150);
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const ecr = manager._ecritures.find((e) => e.type === TypeEcriture.EPARGNE);
    expect(ecr!.montant).toBe(5000); // 5100 - 100 estimés
    expect(manager._epargnesMaj[0].montant).toBe(5000);
  });

  it('frais estimés = frais réels : résultat identique au cas sans frais', async () => {
    const tx = fabriqueTransaction({ montant: 5200, fraisFedapay: 200 });
    fedapayFaux.definirFees(200);
    const manager = fabriqueManager(tx);
    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const ecr = manager._ecritures.find((e) => e.type === TypeEcriture.EPARGNE);
    expect(ecr!.montant).toBe(5000);
    expect(manager._epargnesMaj[0].montant).toBe(5000);
  });

  // ─── RETRAIT + epargne_id → confirmerRetraitEpargne ──────────────────────

  it("transaction RETRAIT liée à une épargne : confirmer() n'écrit pas d'écriture COTISATION", async () => {
    const txRetrait = fabriqueTransaction({
      type: TypeTransaction.RETRAIT,
      montant: 9500,
      fraisFedapay: 0,
      epargne: {
        id: 1,
        montant: 10000,
        dateEcheance: null,
        statut: StatutEpargne.ACTIVE,
        objectifMontant: 10000,
        objectifAtteintLe: null,
      } as Epargne,
    });
    const manager = fabriqueManager(txRetrait);
    const caisses: unknown[] = [];
    const caisseRepoMock = {
      create: jest.fn().mockImplementation((v: unknown) => v),
      save: jest.fn().mockImplementation(async (c: unknown) => {
        caisses.push(c);
        return c;
      }),
    };
    const originalGetRepo = manager.getRepository.bind(manager);
    manager.getRepository = jest.fn().mockImplementation((entity: unknown) => {
      const name = (entity as { name?: string }).name ?? String(entity);
      if (name === 'CaisseApplication') return caisseRepoMock;
      return originalGetRepo(entity);
    });
    const txRepoInternal = manager.getRepository({
      name: 'Transaction',
    }) as { findOne: jest.Mock };
    txRepoInternal.findOne.mockResolvedValue({
      ...txRetrait,
      retraitEpargne: {
        id: 1,
        montant: 10000,
        tauxApplique: 5,
        montantRetenu: 500,
        estAnticipe: true,
      },
    });
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

  // ─── Idempotence ──────────────────────────────────────────────────────────

  it('idempotence — dépôt épargne : confirmer() deux fois en séquence → aucune écriture supplémentaire', async () => {
    const tx = fabriqueTransaction({ montant: 5000, fraisFedapay: 0 });
    const manager = fabriqueManager(tx);

    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );
    const nbEcr1 = manager._ecritures.length;
    const nbEpargne1 = manager._epargnesMaj.length;
    const nbPortefeuille1 = manager._portefeuilleMaj.length;
    const soldeEpargne1 = manager._portefeuilleMaj[0]?.soldeEpargne;

    const txRepoInternal = (
      manager.getRepository as (e: { name: string }) => { findOne: jest.Mock }
    )({ name: 'Transaction' });
    txRepoInternal.findOne.mockResolvedValue({
      ...tx,
      statut: StatutTransaction.REUSSI,
    });

    await transactionService.confirmer(
      1,
      manager as unknown as Parameters<typeof transactionService.confirmer>[1],
    );

    expect(manager._ecritures.length).toBe(nbEcr1);
    expect(manager._epargnesMaj.length).toBe(nbEpargne1);
    expect(manager._portefeuilleMaj.length).toBe(nbPortefeuille1);
    expect(manager._portefeuilleMaj[0].soldeEpargne).toBe(soldeEpargne1);
  });

  it('idempotence — dépôt épargne : deux confirmations parallèles → seul manager EN_ATTENTE crée des écritures', async () => {
    const tx = fabriqueTransaction({ montant: 5000, fraisFedapay: 0 });

    const managerA = fabriqueManager(tx);
    const managerB = fabriqueManager({
      ...tx,
      statut: StatutTransaction.REUSSI,
    });

    const [rA, rB] = await Promise.allSettled([
      transactionService.confirmer(
        1,
        managerA as unknown as Parameters<
          typeof transactionService.confirmer
        >[1],
      ),
      transactionService.confirmer(
        1,
        managerB as unknown as Parameters<
          typeof transactionService.confirmer
        >[1],
      ),
    ]);

    expect(rA.status).toBe('fulfilled');
    expect(rB.status).toBe('fulfilled');

    expect(managerA._ecritures).toHaveLength(1);
    expect(managerA._ecritures[0].type).toBe(TypeEcriture.EPARGNE);
    expect(managerA._epargnesMaj[0].montant).toBe(5000);
    expect(managerA._portefeuilleMaj[0].soldeEpargne).toBe(5000);

    expect(managerB._ecritures).toHaveLength(0);
    expect(managerB._epargnesMaj).toHaveLength(0);
    expect(managerB._portefeuilleMaj).toHaveLength(0);
  });
});

// ─── WebhookFedapayService : cas spéciaux ─────────────────────────────────────

describe('WebhookFedapayService : idFedapay inconnu → ignoré, retourne 200', () => {
  let webhookService: WebhookFedapayService;
  let fedapayFaux: FedapayClientFaux;

  beforeEach(async () => {
    fedapayFaux = new FedapayClientFaux();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WebhookFedapayService,
        TransactionService,
        {
          provide: `${WebhookFedapay.name}Repository`,
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            findOneBy: jest.fn().mockResolvedValue(null),
            create: jest.fn().mockImplementation((v: unknown) => v),
            save: jest.fn().mockImplementation(async (v: unknown) => ({
              ...(v as object),
              id: 1,
            })),
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: `${Transaction.name}Repository`,
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            find: jest.fn().mockResolvedValue([]),
            save: jest.fn().mockResolvedValue({}),
            manager: {
              transaction: jest
                .fn()
                .mockImplementation(async (cb: (m: unknown) => Promise<void>) =>
                  cb({
                    getRepository: jest.fn().mockReturnValue({
                      findOne: jest.fn().mockResolvedValue(null),
                      update: jest.fn().mockResolvedValue(undefined),
                    }),
                  }),
                ),
            },
          },
        },
        { provide: FEDAPAY_CLIENT, useValue: fedapayFaux },
        {
          provide: NotificationService,
          useValue: { create: jest.fn().mockResolvedValue(undefined) },
        },
      ],
    }).compile();

    webhookService = module.get<WebhookFedapayService>(WebhookFedapayService);
  });

  it('transaction inconnue (idFedapay non trouvé) → NotFoundException par traiterDirectement()', async () => {
    // TODO(verifier) : ajouter un test d'intégration pour vérifier que le handler
    //   HTTP retourne bien 200 même quand la transaction interne est introuvable.
    await expect(
      webhookService.traiterDirectement(9999, 'approuve'),
    ).rejects.toThrow(NotFoundException);
  });

  it('idFedapay non trouvé dans traiterEvenement : aucune transaction modifiée', async () => {
    jest.spyOn(fedapayFaux, 'verifierSignatureWebhook').mockReturnValue({
      name: 'transaction.approved',
      object: {},
    });
    const rawBody = Buffer.from(
      JSON.stringify({ name: 'transaction.approved', entity: { id: 99999 } }),
    );
    const result = await webhookService.traiter(rawBody, 'sig-fictive');
    expect(result).toEqual({ recu: true });
  });
});
