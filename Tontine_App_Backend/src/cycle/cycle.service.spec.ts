import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CycleService } from './cycle.service';
import { SouscriptionService } from '../souscription/souscription.service';
import { Cycle } from './entities/cycle.entity';
import { JourCotisation } from '../jour-cotisation/entities/jour-cotisation.entity';
import {
  Regularite,
  StatutCycle,
  StatutJourCotisation,
  StatutSouscription,
} from '../common/enums';
import { dateBeninISO } from '../common/utils/dates.util';

const CYCLE_REPO_TOKEN = `${Cycle.name}Repository`;
const JOUR_REPO_TOKEN = `${JourCotisation.name}Repository`;

function cycleEchu(overrides: Partial<Cycle> = {}): Cycle {
  return Object.assign(new Cycle(), {
    id: 10,
    numero: 1,
    dateDebut: '2026-04-01',
    dateFin: '2026-04-30', // strictement avant aujourd'hui si on est en mai ou plus
    statut: StatutCycle.EN_COURS,
    souscription: { id: 5, statut: StatutSouscription.ACTIVE } as never,
    ...overrides,
  });
}

describe('CycleService', () => {
  let service: CycleService;

  // Chaîne de QueryBuilder pour la mise à jour des jours (clôture).
  const qbChain = {
    update: jest.fn().mockReturnThis(),
    set: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    execute: jest.fn().mockResolvedValue(undefined),
  };

  const cycleRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn((v: unknown) => v),
    update: jest.fn().mockResolvedValue(undefined),
    delete: jest.fn(),
    createQueryBuilder: jest.fn(() => qbChain),
    manager: { transaction: jest.fn() },
  };
  const jourRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(() => qbChain),
  };
  const souscriptionService = {
    trouverActive: jest.fn(),
    genererCycle: jest.fn().mockResolvedValue(undefined),
  };

  const fakeManager = {
    getRepository: jest.fn((entity: unknown) => {
      if (entity === Cycle) return cycleRepo;
      if (entity === JourCotisation) return jourRepo;
      return {};
    }),
    query: jest.fn().mockResolvedValue(undefined),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    // Rétablissement des implémentations de base (resetAllMocks les efface).
    cycleRepo.manager.transaction.mockImplementation(
      (cb: (m: typeof fakeManager) => unknown) => cb(fakeManager),
    );
    fakeManager.getRepository.mockImplementation((entity: unknown) => {
      if (entity === Cycle) return cycleRepo;
      if (entity === JourCotisation) return jourRepo;
      return {};
    });
    fakeManager.query.mockResolvedValue(undefined);
    cycleRepo.create.mockImplementation((v: unknown) => v);
    cycleRepo.save.mockImplementation((v: unknown) => v);
    cycleRepo.update.mockResolvedValue(undefined);
    cycleRepo.createQueryBuilder.mockImplementation(() => qbChain);
    jourRepo.createQueryBuilder.mockImplementation(() => qbChain);
    qbChain.update.mockReturnThis();
    qbChain.set.mockReturnThis();
    qbChain.where.mockReturnThis();
    qbChain.andWhere.mockReturnThis();
    qbChain.execute.mockResolvedValue(undefined);
    souscriptionService.genererCycle.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CycleService,
        { provide: CYCLE_REPO_TOKEN, useValue: cycleRepo },
        { provide: JOUR_REPO_TOKEN, useValue: jourRepo },
        { provide: SouscriptionService, useValue: souscriptionService },
      ],
    }).compile();
    service = module.get(CycleService);
  });

  // ─── Clôture ──────────────────────────────────────────────────────────────

  describe('cloturerEchus', () => {
    it('passe les jours « à payer » à « perdu » et clôture le cycle', async () => {
      cycleRepo.findOne
        .mockResolvedValueOnce(cycleEchu())
        .mockResolvedValueOnce(null);

      const resume = await service.cloturerEchus();

      expect(resume.cyclesClotures).toBe(1);
      // Les jours « à payer » du cycle sont passés à « perdu ».
      expect(qbChain.set).toHaveBeenCalledWith({
        statut: StatutJourCotisation.PERDU,
      });
      expect(qbChain.execute).toHaveBeenCalled();
      // Le cycle est passé à « terminé ».
      expect(cycleRepo.update).toHaveBeenCalledWith(10, {
        statut: StatutCycle.TERMINE,
      });
    });

    it('génère le cycle suivant pour une souscription active', async () => {
      cycleRepo.findOne
        .mockResolvedValueOnce(cycleEchu())
        .mockResolvedValueOnce(null);

      await service.cloturerEchus();

      expect(souscriptionService.genererCycle).toHaveBeenCalledWith(
        5,
        fakeManager,
      );
    });

    it('ne génère pas de cycle suivant pour une souscription clôturée', async () => {
      cycleRepo.findOne
        .mockResolvedValueOnce(
          cycleEchu({
            souscription: {
              id: 5,
              statut: StatutSouscription.CLOTUREE,
            } as never,
          }),
        )
        .mockResolvedValueOnce(null);

      await service.cloturerEchus();

      expect(souscriptionService.genererCycle).not.toHaveBeenCalled();
      expect(cycleRepo.update).toHaveBeenCalledWith(10, {
        statut: StatutCycle.TERMINE,
      });
    });

    it('est idempotent : un deuxième appel ne crée rien en double', async () => {
      cycleRepo.findOne
        .mockResolvedValueOnce(cycleEchu()) // 1er run : un cycle échu
        .mockResolvedValueOnce(null) // 1er run : plus rien
        .mockResolvedValueOnce(null); // 2e run : rien dès le départ

      await service.cloturerEchus();
      await service.cloturerEchus();

      // genererCycle n'a été appelé qu'une seule fois (au 1er run).
      expect(souscriptionService.genererCycle).toHaveBeenCalledTimes(1);
    });

    it('rattrape plusieurs mois de retard (serveur arrêté)', async () => {
      // Deux cycles échus successifs (le 2e serait lui-même échu).
      cycleRepo.findOne
        .mockResolvedValueOnce(
          cycleEchu({
            id: 10,
            souscription: { id: 5, statut: StatutSouscription.ACTIVE } as never,
          }),
        )
        .mockResolvedValueOnce(
          cycleEchu({
            id: 11,
            souscription: { id: 5, statut: StatutSouscription.ACTIVE } as never,
          }),
        )
        .mockResolvedValueOnce(null);

      const resume = await service.cloturerEchus();

      expect(resume.cyclesClotures).toBe(2);
      expect(souscriptionService.genererCycle).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Rattrapage ───────────────────────────────────────────────────────────

  describe('rattraperJours', () => {
    it('refuse un jour appartenant à un autre membre (404, jamais 403)', async () => {
      const jourAutrui = Object.assign(new JourCotisation(), {
        id: 1,
        datePrevue: '2020-01-01',
        montantDu: 500,
        montantPaye: 0,
        statut: StatutJourCotisation.PERDU,
        cycle: { souscription: { membre: { id: 999 } } } as never,
      });
      jourRepo.find.mockResolvedValueOnce([jourAutrui]);

      await expect(service.rattraperJours([1], 7)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('refuse un jour déjà payé', async () => {
      const jourPaye = Object.assign(new JourCotisation(), {
        id: 2,
        datePrevue: '2020-01-02',
        montantDu: 500,
        montantPaye: 500,
        statut: StatutJourCotisation.PAYE,
        cycle: { souscription: { membre: { id: 7 } } } as never,
      });
      jourRepo.find.mockResolvedValueOnce([jourPaye]);

      await expect(service.rattraperJours([2], 7)).rejects.toThrow(
        'rattrapable',
      );
    });

    it('accepte les jours « perdu » et calcule le total à payer', async () => {
      const j1 = Object.assign(new JourCotisation(), {
        id: 3,
        datePrevue: '2020-01-03',
        montantDu: 500,
        montantPaye: 0,
        statut: StatutJourCotisation.PERDU,
        cycle: { souscription: { membre: { id: 7 } } } as never,
      });
      const j2 = Object.assign(new JourCotisation(), {
        id: 4,
        datePrevue: '2020-01-04',
        montantDu: 1000,
        montantPaye: 0,
        statut: StatutJourCotisation.PERDU,
        cycle: { souscription: { membre: { id: 7 } } } as never,
      });
      jourRepo.find.mockResolvedValueOnce([j1, j2]);

      const resultat = await service.rattraperJours([3, 4], 7);

      expect(resultat.jours).toHaveLength(2);
      expect(resultat.total).toBe(1500);
    });

    it('accepte un jour « à payer » déjà échu', async () => {
      const aujourdhui = dateBeninISO();
      const passe = aujourdhui.slice(0, 8) + '01'; // début du mois courant (≤ aujourd'hui)
      const jourEchu = Object.assign(new JourCotisation(), {
        id: 5,
        datePrevue: passe,
        montantDu: 500,
        montantPaye: 0,
        statut: StatutJourCotisation.A_PAYER,
        cycle: { souscription: { membre: { id: 7 } } } as never,
      });
      jourRepo.find.mockResolvedValueOnce([jourEchu]);

      const resultat = await service.rattraperJours([5], 7);
      expect(resultat.total).toBe(500);
    });
  });

  // ─── Isolation entre membres ──────────────────────────────────────────────

  describe('findOne (isolation)', () => {
    it('un membre ne peut pas lire le cycle d’un autre (404)', async () => {
      cycleRepo.findOne.mockResolvedValueOnce(
        Object.assign(new Cycle(), {
          id: 10,
          souscription: { membre: { id: 999 } } as never,
        }),
      );

      await expect(service.findOne(10, 7)).rejects.toThrow(NotFoundException);
    });

    it('renvoie le cycle s’il appartient au membre', async () => {
      cycleRepo.findOne.mockResolvedValueOnce(
        Object.assign(new Cycle(), {
          id: 10,
          numero: 1,
          regularite: Regularite.JOUR,
          souscription: { membre: { id: 7 } } as never,
        }),
      );

      const cycle = await service.findOne(10, 7);
      expect(cycle.id).toBe(10);
    });
  });
});
