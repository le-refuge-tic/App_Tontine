/**
 * Tests unitaires de RapportService.
 *
 * Stratégie :
 * - moisPortoNovo() est testée directement (fonction pure, sans base).
 * - rapport() est testée avec un mock du Repository<EcritureComptable> :
 *   on contrôle les écritures retournées par getMany() et on vérifie les
 *   filtres appliqués (type, totaux).
 */

import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { RapportService } from './rapport.service';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { Cycle } from '../cycle/entities/cycle.entity';
import { SensEcriture, TypeEcriture } from '../common/enums';
import { moisPortoNovo } from '../common/utils/dates.util';

const ECRITURE_REPO_TOKEN = `${EcritureComptable.name}Repository`;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fabriqueEcriture(
  overrides: Partial<EcritureComptable>,
): EcritureComptable {
  return Object.assign(new EcritureComptable(), {
    id: 1,
    type: TypeEcriture.COTISATION,
    montant: 500,
    sens: SensEcriture.CREDIT,
    description: 'test',
    date: new Date('2026-11-15T10:00:00Z'),
    cycle: null,
    transaction: null,
    ...overrides,
  });
}

function fabriqueQb(ecritures: EcritureComptable[]) {
  const qb = {
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(ecritures),
  };
  return qb;
}

// ─── Tests moisPortoNovo (fonction pure) ──────────────────────────────────────

describe('moisPortoNovo (fonction pure)', () => {
  /**
   * Africa/Porto-Novo = UTC+1 fixe (pas d'heure d'été).
   */

  it('30 nov 22h30 UTC  →  30 nov 23h30 Porto-Novo  →  2026-11', () => {
    expect(moisPortoNovo(new Date('2026-11-30T22:30:00Z'))).toBe('2026-11');
  });

  it('30 nov 23h30 UTC  →  01 déc 00h30 Porto-Novo  →  2026-12', () => {
    expect(moisPortoNovo(new Date('2026-11-30T23:30:00Z'))).toBe('2026-12');
  });

  it('01 déc 00h10 Porto-Novo (= 30 nov 23h10 UTC)  →  2026-12', () => {
    // 2026-12-01 00:10 Porto-Novo = 2026-11-30 23:10 UTC
    expect(moisPortoNovo(new Date('2026-11-30T23:10:00Z'))).toBe('2026-12');
  });

  it('minuit pile UTC  →  01h00 Porto-Novo  →  même mois', () => {
    // 2026-12-01 00:00 UTC = 2026-12-01 01:00 Porto-Novo → 2026-12
    expect(moisPortoNovo(new Date('2026-12-01T00:00:00Z'))).toBe('2026-12');
  });

  it('dernier instant de novembre UTC  →  00h59 Porto-Novo le 1er déc  →  2026-12', () => {
    // 2026-11-30 23:59 UTC = 2026-12-01 00:59 Porto-Novo
    expect(moisPortoNovo(new Date('2026-11-30T23:59:00Z'))).toBe('2026-12');
  });
});

// ─── Tests RapportService.rapport() ──────────────────────────────────────────

describe('RapportService', () => {
  let service: RapportService;
  let ecritureRepoMock: { createQueryBuilder: jest.Mock };

  beforeEach(async () => {
    ecritureRepoMock = { createQueryBuilder: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RapportService,
        { provide: ECRITURE_REPO_TOKEN, useValue: ecritureRepoMock },
      ],
    }).compile();

    service = module.get<RapportService>(RapportService);
  });

  // ─── Validation du paramètre mois ────────────────────────────────────────

  it('rejette un format de mois invalide (400)', async () => {
    await expect(service.rapport(1, '2026-1')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.rapport(1, '26-11')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.rapport(1, '2026/11')).rejects.toThrow(
      BadRequestException,
    );
  });

  // ─── Écriture avec cycle classée dans le mois du cycle ───────────────────

  it('écriture avec cycle classée dans le mois du cycle, même si datée du mois suivant', async () => {
    // Rattrapage : écriture de cotisation datée de décembre, cycle de novembre.
    const cycle = Object.assign(new Cycle(), {
      id: 1,
      dateDebut: '2026-11-01',
    });
    const ecritureRattrapage = fabriqueEcriture({
      id: 10,
      type: TypeEcriture.COTISATION,
      sens: SensEcriture.CREDIT,
      montant: 500,
      date: new Date('2026-12-05T10:00:00Z'), // payé en décembre
      cycle, // mais appartient au cycle de novembre
    });

    const qb = fabriqueQb([ecritureRattrapage]);
    ecritureRepoMock.createQueryBuilder.mockReturnValue(qb);

    const rapport = await service.rapport(1, '2026-11');

    // La requête doit filtrer sur cycle.date_debut LIKE '2026-11-%'
    // (CAST(cycle.date_debut AS text) LIKE :moisLike depuis la correction M1).
    const appelsAndWhere = qb.andWhere.mock.calls as [
      string,
      Record<string, string>,
    ][];
    const appelFuseau = appelsAndWhere.find(([sql]) =>
      sql.includes('cycle.date_debut'),
    );
    expect(appelFuseau).toBeDefined();
    expect(appelFuseau![1]).toMatchObject({ moisLike: '2026-11-%' });

    // Le rapport retourne bien cette écriture
    expect(rapport.ecritures).toHaveLength(1);
    expect(rapport.ecritures[0].id).toBe(10);
    expect(rapport.totaux.cotise).toBe(500);
  });

  // ─── Total retiré : liberation_fonds exclu ────────────────────────────────

  it('total retiré exclut liberation_fonds', async () => {
    const ecritureRetrait = fabriqueEcriture({
      id: 20,
      type: TypeEcriture.RETRAIT,
      sens: SensEcriture.DEBIT,
      montant: 1000,
    });
    const ecritureLib = fabriqueEcriture({
      id: 21,
      type: TypeEcriture.LIBERATION_FONDS,
      sens: SensEcriture.DEBIT,
      montant: 500,
    });

    ecritureRepoMock.createQueryBuilder.mockReturnValue(
      fabriqueQb([ecritureRetrait, ecritureLib]),
    );

    const rapport = await service.rapport(1, '2026-11');

    // liberation_fonds visible dans la liste "tout"
    expect(rapport.ecritures).toHaveLength(2);
    // mais pas dans le total retiré
    expect(rapport.totaux.retire).toBe(1000);
  });

  // ─── Filtre "retraits" : liberation_fonds exclu ───────────────────────────

  it("filtre retraits n'envoie pas liberation_fonds à la DB", async () => {
    const qb = fabriqueQb([]);
    ecritureRepoMock.createQueryBuilder.mockReturnValue(qb);

    await service.rapport(1, '2026-11', 'retraits');

    // andWhere doit avoir été appelé avec e.type = 'retrait' (pas liberation_fonds)
    const appelsAndWhere = qb.andWhere.mock.calls as [
      string,
      Record<string, unknown>,
    ][];
    const appelType = appelsAndWhere.find(([, params]) =>
      Object.values(params).includes(TypeEcriture.RETRAIT),
    );
    expect(appelType).toBeDefined();
    // liberation_fonds ne doit pas apparaître dans les paramètres du filtre
    const tousParams = appelsAndWhere.flatMap(([, params]) =>
      Object.values(params),
    );
    expect(tousParams).not.toContain(TypeEcriture.LIBERATION_FONDS);
  });

  // ─── Filtre "cotisations" ─────────────────────────────────────────────────

  it('filtre cotisations ajoute andWhere sur TypeEcriture.COTISATION', async () => {
    const qb = fabriqueQb([]);
    ecritureRepoMock.createQueryBuilder.mockReturnValue(qb);

    await service.rapport(1, '2026-11', 'cotisations');

    const appelsAndWhere = qb.andWhere.mock.calls as [
      string,
      Record<string, unknown>,
    ][];
    const appelType = appelsAndWhere.find(([, params]) =>
      Object.values(params).includes(TypeEcriture.COTISATION),
    );
    expect(appelType).toBeDefined();
  });

  // ─── Totaux calculés correctement ────────────────────────────────────────

  it('calcule correctement tous les totaux', async () => {
    const ecritures = [
      fabriqueEcriture({
        type: TypeEcriture.COTISATION,
        sens: SensEcriture.CREDIT,
        montant: 300,
      }),
      fabriqueEcriture({
        type: TypeEcriture.COTISATION,
        sens: SensEcriture.CREDIT,
        montant: 200,
      }),
      fabriqueEcriture({
        type: TypeEcriture.RETRAIT,
        sens: SensEcriture.DEBIT,
        montant: 400,
      }),
      fabriqueEcriture({
        type: TypeEcriture.LIBERATION_FONDS,
        sens: SensEcriture.DEBIT,
        montant: 100,
      }),
      fabriqueEcriture({
        type: TypeEcriture.FONDS_CAISSE,
        sens: SensEcriture.DEBIT,
        montant: 50,
      }),
    ];

    ecritureRepoMock.createQueryBuilder.mockReturnValue(fabriqueQb(ecritures));

    const rapport = await service.rapport(1, '2026-11');

    expect(rapport.totaux.cotise).toBe(500); // 300 + 200
    expect(rapport.totaux.retire).toBe(400); // liberation_fonds exclu
    expect(rapport.totaux.fondsRetenu).toBe(50);
  });

  // ─── Expression SQL fuseau : vérification des paramètres passés ──────────

  it('passe moisLike et mois corrects à la requête SQL', async () => {
    const qb = fabriqueQb([]);
    ecritureRepoMock.createQueryBuilder.mockReturnValue(qb);

    await service.rapport(1, '2026-11');

    const appelsAndWhere = qb.andWhere.mock.calls as [
      string,
      Record<string, string>,
    ][];
    // Le premier andWhere contient la condition de regroupement par mois
    const appelFuseau = appelsAndWhere.find(([sql]) =>
      sql.includes('Africa/Porto-Novo'),
    );
    expect(appelFuseau).toBeDefined();
    expect(appelFuseau![1]).toMatchObject({
      moisLike: '2026-11-%',
      mois: '2026-11',
    });
  });

  // ─── Alias moisPortoNovo ──────────────────────────────────────────────────

  it('service.moisPortoNovo délègue à la fonction pure', () => {
    // 2026-11-30 22:30 UTC = 2026-11-30 23:30 Porto-Novo → 2026-11
    expect(service.moisPortoNovo(new Date('2026-11-30T22:30:00Z'))).toBe(
      '2026-11',
    );
    // 2026-11-30 23:30 UTC = 2026-12-01 00:30 Porto-Novo → 2026-12
    expect(service.moisPortoNovo(new Date('2026-11-30T23:30:00Z'))).toBe(
      '2026-12',
    );
  });

  // ─── Libellés des écritures épargne ──────────────────────────────────────

  it('libellés : Dépôt épargne, Retrait épargne, Pénalité retrait anticipé, Retenue de tenue du fonds', async () => {
    const ecritures = [
      fabriqueEcriture({
        id: 30,
        type: TypeEcriture.EPARGNE,
        sens: SensEcriture.CREDIT,
        montant: 5000,
        description: 'Dépôt épargne',
      }),
      fabriqueEcriture({
        id: 31,
        type: TypeEcriture.RETRAIT_EPARGNE,
        sens: SensEcriture.DEBIT,
        montant: 4750,
        description: 'Retrait épargne',
      }),
      fabriqueEcriture({
        id: 32,
        type: TypeEcriture.PENALITE,
        sens: SensEcriture.DEBIT,
        montant: 250,
        description: 'Pénalité retrait anticipé',
      }),
      fabriqueEcriture({
        id: 33,
        type: TypeEcriture.RETENUE_EPARGNE,
        sens: SensEcriture.DEBIT,
        montant: 138,
        description: 'Retenue de tenue du fonds',
      }),
    ];
    ecritureRepoMock.createQueryBuilder.mockReturnValue(fabriqueQb(ecritures));
    const rapport = await service.rapport(1, '2026-11');
    const descs = rapport.ecritures.map((e) => e.description);
    expect(descs).toContain('Dépôt épargne');
    expect(descs).toContain('Retrait épargne');
    expect(descs).toContain('Pénalité retrait anticipé');
    expect(descs).toContain('Retenue de tenue du fonds');
  });

  // ─── Total retiré cotisation inchangé par un retrait d'épargne ───────────

  it('un retrait d\'épargne n\'affecte pas le total retiré de cotisation', async () => {
    const ecritures = [
      // Retrait de cotisation classique → compte dans retire.
      fabriqueEcriture({
        id: 40,
        type: TypeEcriture.RETRAIT,
        sens: SensEcriture.DEBIT,
        montant: 3000,
      }),
      // Retrait d'épargne (net versé) → NE compte PAS dans retire.
      fabriqueEcriture({
        id: 41,
        type: TypeEcriture.RETRAIT_EPARGNE,
        sens: SensEcriture.DEBIT,
        montant: 4750,
      }),
      // Pénalité épargne → NE compte PAS dans retire.
      fabriqueEcriture({
        id: 42,
        type: TypeEcriture.PENALITE,
        sens: SensEcriture.DEBIT,
        montant: 250,
      }),
    ];
    ecritureRepoMock.createQueryBuilder.mockReturnValue(fabriqueQb(ecritures));
    const rapport = await service.rapport(1, '2026-11');
    // Seul le retrait de cotisation doit figurer dans retire.
    expect(rapport.totaux.retire).toBe(3000);
    // La somme épargne retirée est bien comptée séparément.
    expect(rapport.totaux.epargneRetire).toBe(5000); // 4750 + 250
  });

  // ─── Total épargne déposée séparé du total cotisation ────────────────────

  it('total épargneDepose est séparé du total cotise', async () => {
    const ecritures = [
      fabriqueEcriture({
        id: 50,
        type: TypeEcriture.COTISATION,
        sens: SensEcriture.CREDIT,
        montant: 1000,
      }),
      fabriqueEcriture({
        id: 51,
        type: TypeEcriture.EPARGNE,
        sens: SensEcriture.CREDIT,
        montant: 2000,
      }),
    ];
    ecritureRepoMock.createQueryBuilder.mockReturnValue(fabriqueQb(ecritures));
    const rapport = await service.rapport(1, '2026-11');
    expect(rapport.totaux.cotise).toBe(1000);
    expect(rapport.totaux.epargneDepose).toBe(2000);
    // Les deux totaux sont indépendants.
    expect(rapport.totaux.cotise + rapport.totaux.epargneDepose).toBe(3000);
  });
});
