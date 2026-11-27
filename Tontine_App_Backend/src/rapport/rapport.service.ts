import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { TypeEcriture, SensEcriture } from '../common/enums';
import { moisPortoNovo } from '../common/utils/dates.util';

export interface TotauxRapport {
  cotise: number;
  retire: number;
  fondsRetenu: number;
  /** Total épargné (dépôts d'épargne) sur le mois. */
  epargneDepose: number;
  /** Total retiré d'épargne (retraits + pénalités + retenues) sur le mois. */
  epargneRetire: number;
}

/**
 * Écriture comptable enrichie avec le nom du projet (si écriture d'épargne).
 */
export interface EcritureRapport extends EcritureComptable {
  /**
   * Nom du projet d'épargne si l'écriture est liée à une épargne (dépôt,
   * retrait d'épargne, pénalité, retenue). Null sinon.
   *
   * Calculé à la lecture (JOIN avec epargnes via transaction.epargne_id).
   */
  projetNom: string | null;
}

export interface RapportMensuel {
  mois: string;
  ecritures: EcritureRapport[];
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
   * Regroupement par mois :
   * - Écriture avec cycle  → classée dans le mois de `cycle.date_debut`.
   * - Écriture sans cycle  → classée dans le mois de `e.date` converti en
   *   Africa/Porto-Novo (UTC+1 fixe). La colonne `date` est `timestamptz` :
   *   l'expression SQL `e.date AT TIME ZONE 'Africa/Porto-Novo'` suffit pour
   *   obtenir l'heure locale (pas besoin du double-cast UTC nécessaire avec
   *   `timestamp` sans fuseau).
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
      .leftJoinAndSelect('transaction.epargne', 'epargne') // JOIN pour projetNom
      .where('e.membre_id = :membreId', { membreId })
      .andWhere(
        // Écriture avec cycle → mois du début de cycle.
        //   date_debut est de type DATE : il faut caster en TEXT avant LIKE.
        // Écriture sans cycle → mois de e.date converti en Africa/Porto-Novo.
        //   La colonne `date` est TIMESTAMPTZ : AT TIME ZONE renvoie un TIMESTAMP
        //   local (sans fuseau). TO_CHAR extrait ensuite AAAA-MM.
        `(
          (cycle.id IS NOT NULL AND CAST(cycle.date_debut AS text) LIKE :moisLike)
          OR
          (cycle.id IS NULL AND TO_CHAR(e.date AT TIME ZONE 'Africa/Porto-Novo', 'YYYY-MM') = :mois)
        )`,
        { moisLike: `${mois}-%`, mois },
      )
      .orderBy('e.date', 'DESC');

    if (type === 'cotisations') {
      qb.andWhere('e.type = :typeCot', { typeCot: TypeEcriture.COTISATION });
    } else if (type === 'retraits') {
      // liberation_fonds est exclu du filtre "retraits" : ce n'est pas un vrai
      // retrait versé au membre.
      qb.andWhere('e.type = :typeRet', { typeRet: TypeEcriture.RETRAIT });
    }

    const ecritures = await qb.getMany();

    // Enrichir chaque écriture avec projetNom (calculé à la lecture).
    const ecrituresAvecProjet: EcritureRapport[] = ecritures.map((e) => ({
      ...e,
      projetNom: e.transaction?.epargne?.nom ?? null,
    }));

    const totaux: TotauxRapport = {
      cotise: ecrituresAvecProjet
        .filter(
          (e) =>
            e.type === TypeEcriture.COTISATION &&
            e.sens === SensEcriture.CREDIT,
        )
        .reduce((s, e) => s + e.montant, 0),
      // liberation_fonds exclu du total retiré : seul le montant réellement
      // versé au membre (écriture RETRAIT) compte. Les retraits d'épargne
      // (`retrait_epargne`, `penalite`, `retenue_epargne`) sont exclus du
      // total retiré de cotisation : ils sont comptés dans `epargneRetire`.
      retire: ecrituresAvecProjet
        .filter(
          (e) =>
            e.type === TypeEcriture.RETRAIT && e.sens === SensEcriture.DEBIT,
        )
        .reduce((s, e) => s + e.montant, 0),
      fondsRetenu: ecrituresAvecProjet
        .filter(
          (e) =>
            e.type === TypeEcriture.FONDS_CAISSE &&
            e.sens === SensEcriture.DEBIT,
        )
        .reduce((s, e) => s + e.montant, 0),
      epargneDepose: ecrituresAvecProjet
        .filter(
          (e) =>
            e.type === TypeEcriture.EPARGNE && e.sens === SensEcriture.CREDIT,
        )
        .reduce((s, e) => s + e.montant, 0),
      epargneRetire: ecrituresAvecProjet
        .filter(
          (e) =>
            (e.type === TypeEcriture.RETRAIT_EPARGNE ||
              e.type === TypeEcriture.PENALITE ||
              e.type === TypeEcriture.RETENUE_EPARGNE) &&
            e.sens === SensEcriture.DEBIT,
        )
        .reduce((s, e) => s + e.montant, 0),
    };

    return { mois, ecritures: ecrituresAvecProjet, totaux };
  }

  /**
   * Alias exposé pour faciliter les tests unitaires : calcule le mois
   * Africa/Porto-Novo d'un instant donné, au format `AAAA-MM`.
   *
   * C'est la contrepartie TypeScript de l'expression SQL
   * `TO_CHAR(e.date AT TIME ZONE 'Africa/Porto-Novo', 'YYYY-MM')`.
   */
  moisPortoNovo(date: Date): string {
    return moisPortoNovo(date);
  }
}
