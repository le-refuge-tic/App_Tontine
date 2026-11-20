import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JourCotisationService } from './jour-cotisation.service';
import { JourCotisation } from './entities/jour-cotisation.entity';
import { StatutJourCotisation } from '../common/enums';

const JOUR_REPO_TOKEN = `${JourCotisation.name}Repository`;

function makeJour(overrides: Partial<JourCotisation> = {}): JourCotisation {
  return Object.assign(new JourCotisation(), {
    id: 1,
    numeroJour: 1,
    datePrevue: '2026-11-01',
    coefficient: 1,
    montantDu: 500,
    montantPaye: 0,
    statut: StatutJourCotisation.A_PAYER,
    ...overrides,
  });
}

describe('JourCotisationService.marquerPaye', () => {
  let service: JourCotisationService;

  const repo = {
    findOne: jest.fn(),
    find: jest.fn(),
    create: jest.fn((v: unknown) => v),
    save: jest.fn((v: unknown) => v),
    update: jest.fn(),
    delete: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        JourCotisationService,
        { provide: JOUR_REPO_TOKEN, useValue: repo },
      ],
    }).compile();
    service = module.get(JourCotisationService);
  });

  it('ajoute le montant à montantPaye et passe à « payé » dès que atteint', async () => {
    repo.findOne.mockResolvedValueOnce(
      makeJour({ montantDu: 500, montantPaye: 0 }),
    );

    const jour = await service.marquerPaye(1, 500);

    expect(jour.montantPaye).toBe(500);
    expect(jour.statut).toBe(StatutJourCotisation.PAYE);
    expect(repo.save).toHaveBeenCalled();
  });

  it('garde le statut « à payer » si le paiement est partiel', async () => {
    repo.findOne.mockResolvedValueOnce(
      makeJour({ montantDu: 1000, montantPaye: 0 }),
    );

    const jour = await service.marquerPaye(1, 400);

    expect(jour.montantPaye).toBe(400);
    expect(jour.statut).toBe(StatutJourCotisation.A_PAYER);
  });

  it('refuse un jour déjà payé (pas de double paiement)', async () => {
    repo.findOne.mockResolvedValueOnce(
      makeJour({ statut: StatutJourCotisation.PAYE, montantPaye: 500 }),
    );

    await expect(service.marquerPaye(1, 500)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('refuse un montant nul ou négatif', async () => {
    await expect(service.marquerPaye(1, 0)).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.marquerPaye(1, -100)).rejects.toThrow(
      BadRequestException,
    );
  });

  it('lève 404 si le jour est introuvable', async () => {
    repo.findOne.mockResolvedValueOnce(null);
    await expect(service.marquerPaye(999, 500)).rejects.toThrow(
      NotFoundException,
    );
  });
});
