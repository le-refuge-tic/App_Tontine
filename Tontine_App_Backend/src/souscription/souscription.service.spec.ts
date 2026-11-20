import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { SouscriptionService } from './souscription.service';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { Souscription } from './entities/souscription.entity';
import { Cycle } from '../cycle/entities/cycle.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import {
  Regularite,
  StatutCycle,
  StatutJourCotisation,
  StatutSouscription,
} from '../common/enums';

// Tokens d'injection (cf. mock @nestjs/typeorm) : `${Entity.name}Repository`.
const SOUSCRIPTION_REPO_TOKEN = `${Souscription.name}Repository`;
const CYCLE_REPO_TOKEN = `${Cycle.name}Repository`;
const PORTEFEUILLE_REPO_TOKEN = `${Portefeuille.name}Repository`;

function makeSouscription(overrides: Partial<Souscription> = {}): Souscription {
  return Object.assign(new Souscription(), {
    id: 1,
    miseBase: 500,
    regularite: Regularite.JOUR,
    prochaineMiseBase: null,
    prochaineRegularite: null,
    dateDemarrage: '2026-11-15',
    statut: StatutSouscription.ACTIVE,
    membre: { id: 7 } as never,
    ...overrides,
  });
}

describe('SouscriptionService', () => {
  let service: SouscriptionService;

  const souscriptionRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn((v: unknown) => v),
    update: jest.fn(),
    delete: jest.fn(),
    manager: { transaction: jest.fn() },
  };
  const cycleRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn((v: unknown) => v),
  };
  const portefeuilleRepo = {
    findOne: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn((v: unknown) => v),
  };
  const parametres = {
    getNumber: jest.fn().mockResolvedValue(200),
  };

  // Faux manager de transaction : route getRepository vers les bons mocks.
  const fakeManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Souscription) return souscriptionRepo;
      if (entity === Cycle) return cycleRepo;
      if (entity === Portefeuille) return portefeuilleRepo;
      return {};
    }),
    query: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    // Rétablissement des implémentations de base (resetAllMocks les efface).
    souscriptionRepo.manager.transaction.mockImplementation(
      (cb: (m: typeof fakeManager) => unknown) => cb(fakeManager),
    );
    fakeManager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Souscription) return souscriptionRepo;
      if (entity === Cycle) return cycleRepo;
      if (entity === Portefeuille) return portefeuilleRepo;
      return {};
    });
    fakeManager.query.mockResolvedValue(undefined);
    souscriptionRepo.create.mockImplementation((v: Record<string, unknown>) =>
      Object.assign(new Souscription(), v),
    );
    souscriptionRepo.save.mockImplementation((v: unknown) => v);
    portefeuilleRepo.create.mockImplementation((v: Record<string, unknown>) =>
      Object.assign(new Portefeuille(), v),
    );
    portefeuilleRepo.save.mockImplementation((v: unknown) => v);
    cycleRepo.create.mockImplementation((v: unknown) => v);
    cycleRepo.save.mockImplementation((v: unknown) => v);
    parametres.getNumber.mockResolvedValue(200);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SouscriptionService,
        { provide: SOUSCRIPTION_REPO_TOKEN, useValue: souscriptionRepo },
        { provide: CYCLE_REPO_TOKEN, useValue: cycleRepo },
        { provide: PORTEFEUILLE_REPO_TOKEN, useValue: portefeuilleRepo },
        { provide: ParametreSystemeService, useValue: parametres },
      ],
    }).compile();
    service = module.get(SouscriptionService);
  });

  // ─── creerPourMembre ───────────────────────────────────────────────────────

  describe('creerPourMembre', () => {
    it('refuse si une souscription active existe déjà (409)', async () => {
      souscriptionRepo.findOne.mockResolvedValueOnce(makeSouscription());

      await expect(
        service.creerPourMembre(7, {
          miseBase: 500,
          regularite: Regularite.JOUR,
        }),
      ).rejects.toThrow(ConflictException);
    });

    it('refuse si la mise est inférieure à mise_minimale (400)', async () => {
      souscriptionRepo.findOne.mockResolvedValueOnce(null); // pas d'active
      parametres.getNumber.mockResolvedValueOnce(200);

      await expect(
        service.creerPourMembre(7, {
          miseBase: 100,
          regularite: Regularite.JOUR,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('crée la souscription, le portefeuille et génère le cycle 1', async () => {
      souscriptionRepo.findOne
        .mockResolvedValueOnce(null) // contrôle : pas d'active
        .mockResolvedValueOnce(makeSouscription({ id: 1 })); // rechargée par genererCycle
      portefeuilleRepo.findOne.mockResolvedValueOnce(null); // pas de portefeuille
      cycleRepo.find.mockResolvedValueOnce([]); // aucun cycle → numero 1

      const result = await service.creerPourMembre(7, {
        miseBase: 500,
        regularite: Regularite.JOUR,
      });

      // La souscription est sauvegardée…
      expect(souscriptionRepo.save).toHaveBeenCalled();
      // …le portefeuille est créé…
      expect(portefeuilleRepo.save).toHaveBeenCalled();
      // …et le cycle 1 est sauvegardé (cascade des jours).
      expect(cycleRepo.save).toHaveBeenCalled();
      expect(result).toBeInstanceOf(Souscription);
    });
  });

  // ─── genererCycle ─────────────────────────────────────────────────────────

  describe('genererCycle', () => {
    it('génère le cycle 1 avec le bon nombre de jours, les bonnes dates et montantDu = mise × coefficient', async () => {
      const souscription = makeSouscription({ dateDemarrage: '2026-04-01' });
      souscriptionRepo.findOne.mockResolvedValueOnce(souscription);
      cycleRepo.find.mockResolvedValueOnce([]); // premier cycle

      await service.genererCycle(1, fakeManager as never);

      const cycleSauve = cycleRepo.save.mock.calls[0][0] as Cycle;
      expect(cycleSauve.numero).toBe(1);
      expect(cycleSauve.dateDebut).toBe('2026-04-01');
      expect(cycleSauve.dateFin).toBe('2026-04-30'); // avril = 30 jours
      expect(cycleSauve.statut).toBe(StatutCycle.EN_COURS);
      expect(cycleSauve.fondsCaisseRetenu).toBe(500);

      const jours = cycleSauve.jourCotisations;
      expect(jours).toHaveLength(30);
      expect(jours[0].datePrevue).toBe('2026-04-01');
      expect(jours[29].datePrevue).toBe('2026-04-30');
      expect(jours.reduce((s, j) => s + j.coefficient, 0)).toBe(31);
      expect(jours[29].coefficient).toBe(2);
      expect(jours[29].montantDu).toBe(500 * 2);
      expect(
        jours.every((j) => j.statut === StatutJourCotisation.A_PAYER),
      ).toBe(true);
    });

    it('applique prochaineMiseBase au cycle suivant et vide la demande', async () => {
      const souscription = makeSouscription({
        miseBase: 500,
        prochaineMiseBase: 1000,
      });
      souscriptionRepo.findOne.mockResolvedValueOnce(souscription);
      cycleRepo.find.mockResolvedValueOnce([
        { numero: 1, dateFin: '2026-04-30' } as Cycle,
      ]);

      await service.genererCycle(1, fakeManager as never);

      // La souscription est mise à jour : nouvelle mise appliquée et vidée.
      expect(souscription.miseBase).toBe(1000);
      expect(souscription.prochaineMiseBase).toBeNull();

      const cycleSauve = cycleRepo.save.mock.calls[0][0] as Cycle;
      expect(cycleSauve.numero).toBe(2);
      expect(cycleSauve.miseBase).toBe(1000); // nouvelle mise figée
      expect(cycleSauve.dateDebut).toBe('2026-05-01'); // mois suivant
      expect(cycleSauve.dateFin).toBe('2026-05-31');
      expect(cycleSauve.jourCotisations[0].montantDu).toBe(1000);
    });
  });

  // ─── trouverActive ────────────────────────────────────────────────────────

  it('trouverActive lève 404 si aucune souscription active', async () => {
    souscriptionRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.trouverActive(7)).rejects.toThrow(NotFoundException);
  });

  // ─── demanderChangement ───────────────────────────────────────────────────

  describe('demanderChangement', () => {
    it('remplit prochaineMiseBase sans toucher au cycle en cours', async () => {
      const souscription = makeSouscription({
        miseBase: 500,
        prochaineMiseBase: null,
      });
      souscriptionRepo.findOne.mockResolvedValueOnce(souscription);

      await service.demanderChangement(7, { miseBase: 1000 });

      // La mise actuelle est inchangée : seule la prochaine est fixée.
      expect(souscription.miseBase).toBe(500);
      expect(souscription.prochaineMiseBase).toBe(1000);
      expect(souscriptionRepo.save).toHaveBeenCalledWith(souscription);
    });

    it('refuse si aucune valeur fournie', async () => {
      souscriptionRepo.findOne.mockResolvedValueOnce(makeSouscription());
      await expect(service.demanderChangement(7, {})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('refuse une mise inférieure à mise_minimale', async () => {
      souscriptionRepo.findOne.mockResolvedValueOnce(makeSouscription());
      parametres.getNumber.mockResolvedValueOnce(200);
      await expect(
        service.demanderChangement(7, { miseBase: 100 }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
