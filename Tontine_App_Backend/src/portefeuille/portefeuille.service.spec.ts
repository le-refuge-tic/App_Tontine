import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PortefeuilleService } from './portefeuille.service';
import { Portefeuille } from './entities/portefeuille.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { TypeEcriture } from '../common/enums';

const PORTEFEUILLE_REPO_TOKEN = `${Portefeuille.name}Repository`;
const ECRITURE_REPO_TOKEN = `${EcritureComptable.name}Repository`;

describe('PortefeuilleService', () => {
  let service: PortefeuilleService;

  const portefeuilleRepo = {
    findOne: jest.fn(),
    find: jest.fn(),
  };

  // Chaîne de QueryBuilder pour la somme des écritures fonds_caisse.
  const ecQb = {
    select: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    getRawOne: jest.fn(),
  };
  const ecritureRepo = {
    createQueryBuilder: jest.fn(() => ecQb),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    ecQb.select.mockReturnThis();
    ecQb.where.mockReturnThis();
    ecQb.andWhere.mockReturnThis();
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PortefeuilleService,
        { provide: PORTEFEUILLE_REPO_TOKEN, useValue: portefeuilleRepo },
        { provide: ECRITURE_REPO_TOKEN, useValue: ecritureRepo },
      ],
    }).compile();
    service = module.get(PortefeuilleService);
  });

  function portefeuille(soldeCotisation: number, soldeBloque = 0) {
    return Object.assign(new Portefeuille(), {
      id: 1,
      soldeCotisation,
      soldeEpargne: 0,
      soldeBloque,
      membre: { id: 7 } as never,
    });
  }

  it('vaut 0 partout quand il n’y a aucune écriture', async () => {
    portefeuilleRepo.findOne.mockResolvedValueOnce(portefeuille(0, 0));
    ecQb.getRawOne.mockResolvedValueOnce({ total: '0' });

    const vue = await service.trouverMoi(7);

    expect(vue).toEqual({
      soldeCotisation: 0,
      soldeEpargne: 0,
      soldeBloque: 0,
      fondsCaisseRetenu: 0,
      retirable: 0,
    });
  });

  it('calcule retirable = soldeCotisation − fondsCaisseRetenu − soldeBloque', async () => {
    portefeuilleRepo.findOne.mockResolvedValueOnce(portefeuille(15500, 1000));
    ecQb.getRawOne.mockResolvedValueOnce({ total: '500' }); // fonds de caisse retenu

    const vue = await service.trouverMoi(7);

    expect(vue.fondsCaisseRetenu).toBe(500);
    expect(vue.retirable).toBe(15500 - 500 - 1000); // 14000
  });

  it('ne descend jamais sous zéro', async () => {
    // fondsCaisseRetenu + soldeBloque > soldeCotisation
    portefeuilleRepo.findOne.mockResolvedValueOnce(portefeuille(300, 500));
    ecQb.getRawOne.mockResolvedValueOnce({ total: '500' });

    const vue = await service.trouverMoi(7);

    expect(vue.retirable).toBe(0);
  });

  it('lève 404 si le membre n’a pas de portefeuille', async () => {
    portefeuilleRepo.findOne.mockResolvedValueOnce(null);
    await expect(service.trouverMoi(7)).rejects.toThrow(NotFoundException);
  });

  it('filtre les écritures sur le type fonds_caisse du membre', async () => {
    portefeuilleRepo.findOne.mockResolvedValueOnce(portefeuille(1000, 0));
    ecQb.getRawOne.mockResolvedValueOnce({ total: '0' });

    await service.trouverMoi(7);

    expect(ecQb.where).toHaveBeenCalledWith('e.membre_id = :membreId', {
      membreId: 7,
    });
    expect(ecQb.andWhere).toHaveBeenCalledWith('e.type = :type', {
      type: TypeEcriture.FONDS_CAISSE,
    });
  });

  it('retirableDuMois renvoie le retirable', async () => {
    portefeuilleRepo.findOne.mockResolvedValueOnce(portefeuille(5000, 0));
    ecQb.getRawOne.mockResolvedValueOnce({ total: '500' });

    expect(await service.retirableDuMois(7)).toBe(4500);
  });
});
