import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { TypeEcriture, SensEcriture } from '../common/enums';

export interface TotauxRapport {
  cotise: number;
  retire: number;
  fondsRetenu: number;
}

export interface RapportMensuel {
  mois: string;
  ecritures: EcritureComptable[];
  totaux: TotauxRapport;
}

@Injectable()
export class RapportService {
  constructor(
    @InjectRepository(EcritureComptable)
    private readonly ecritureRepo: Repository<EcritureComptable>,
  ) {}

  /**
   * Renvoie le rapport mensuel d'un membre.
   *
   * @param membreId  Identifiant du membre.
   * @param mois      Mois au format `AAAA-MM`.
   * @param type      Filtre : 'tout' | 'cotisations' | 'retraits'.
   */
  async rapport(
    membreId: number,
    mois: string,
    type: 'tout' | 'cotisations' | 'retraits' = 'tout',
  ): Promise<RapportMensuel> {
    if (!/^\d{4}-\d{2}$/.test(mois)) {
      throw new BadRequestException(
        'Le paramètre `mois` doit être au format AAAA-MM (ex. 2025-01).',
      );
    }

    const qb = this.ecritureRepo
      .createQueryBuilder('e')
      .leftJoinAndSelect('e.cycle', 'cycle')
      .leftJoinAndSelect('e.transaction', 'transaction')
      .where('e.membre_id = :membreId', { membreId })
      .andWhere(
        // Inclure : (cycle dont le mois de début = mois demandé) OU (sans cycle)
        '(cycle.id IS NULL OR cycle.date_debut LIKE :moisLike)',
        { moisLike: `${mois}-%` },
      )
      .orderBy('e.date', 'DESC');

    if (type === 'cotisations') {
      qb.andWhere('e.type = :typeCot', { typeCot: TypeEcriture.COTISATION });
    } else if (type === 'retraits') {
      qb.andWhere('e.type = :typeRet', { typeRet: TypeEcriture.RETRAIT });
    }

    const ecritures = await qb.getMany();

    const totaux: TotauxRapport = {
      cotise: ecritures
        .filter(
          (e) =>
            e.type === TypeEcriture.COTISATION &&
            e.sens === SensEcriture.CREDIT,
        )
        .reduce((s, e) => s + e.montant, 0),
      retire: ecritures
        .filter(
          (e) =>
            e.type === TypeEcriture.RETRAIT && e.sens === SensEcriture.DEBIT,
        )
        .reduce((s, e) => s + e.montant, 0),
      fondsRetenu: ecritures
        .filter(
          (e) =>
            e.type === TypeEcriture.FONDS_CAISSE &&
            e.sens === SensEcriture.DEBIT,
        )
        .reduce((s, e) => s + e.montant, 0),
    };

    return { mois, ecritures, totaux };
  }
}
