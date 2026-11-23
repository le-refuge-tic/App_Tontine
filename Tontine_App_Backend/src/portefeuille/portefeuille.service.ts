import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portefeuille } from './entities/portefeuille.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import {
  StatutTransaction,
  TypeEcriture,
  TypeTransaction,
} from '../common/enums';

export interface PortefeuilleVue {
  soldeCotisation: number;
  soldeEpargne: number;
  soldeBloque: number;
  fondsCaisseRetenu: number;
  retirable: number;
}

@Injectable()
export class PortefeuilleService {
  constructor(
    @InjectRepository(Portefeuille)
    private readonly repo: Repository<Portefeuille>,
    @InjectRepository(EcritureComptable)
    private readonly ecritureRepo: Repository<EcritureComptable>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
  ) {}

  findAll(membreId?: number): Promise<Portefeuille[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { membre: { id: membreId } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<Portefeuille> {
    const p = await this.repo.findOne({
      where: { id },
      relations: { membre: true },
    });
    if (!p) throw new NotFoundException(`Portefeuille introuvable : ${id}.`);
    if (membreId !== undefined && p.membre.id !== membreId) {
      throw new NotFoundException(`Portefeuille introuvable : ${id}.`);
    }
    return p;
  }

  /**
   * Vue du portefeuille du membre connecté.
   *  - `fondsCaisseRetenu` = somme des écritures `fonds_caisse` du membre
   *    (montant réellement retenu, 0 tant qu'aucun dépôt n'a eu lieu).
   *  - `retirable` = max(0, soldeCotisation − fondsCaisseRetenu − soldeBloque
   *                        − retraitsEnAttente).
   *
   * Sans aucune écriture, tout vaut 0 sans erreur.
   */
  async trouverMoi(membreId: number): Promise<PortefeuilleVue> {
    const portefeuille = await this.repo.findOne({
      where: { membre: { id: membreId } },
    });
    if (!portefeuille) {
      throw new NotFoundException('Portefeuille introuvable.');
    }

    const fondsCaisseRetenu = await this.fondsCaisseRetenuDuMembre(membreId);

    // Retraits en attente : on les déduit du retirable pour que le membre ne
    // puisse pas initier deux retraits simultanés.
    // NB : `epargne_id IS NULL` isole les retraits de cotisation des retraits
    // d'épargne (type `retrait` partagé). Un retrait d'épargne en attente ne
    // doit pas réduire le retirable de cotisation.
    const retraitReserveResult = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.montant), 0)', 'total')
      .where('tx.membre_id = :membreId', { membreId })
      .andWhere('tx.type = :type', { type: TypeTransaction.RETRAIT })
      .andWhere('tx.statut = :statut', { statut: StatutTransaction.EN_ATTENTE })
      .andWhere('tx.epargne_id IS NULL')
      .getRawOne<{ total: string }>();
    const retraitReserve = Number(retraitReserveResult?.total ?? 0);

    const retirable = Math.max(
      0,
      portefeuille.soldeCotisation -
        fondsCaisseRetenu -
        portefeuille.soldeBloque -
        retraitReserve,
    );

    return {
      soldeCotisation: portefeuille.soldeCotisation,
      soldeEpargne: portefeuille.soldeEpargne,
      soldeBloque: portefeuille.soldeBloque,
      fondsCaisseRetenu,
      retirable,
    };
  }

  /** Somme des montants des écritures `fonds_caisse` du membre (retenu réel). */
  async fondsCaisseRetenuDuMembre(membreId: number): Promise<number> {
    const resultat = await this.ecritureRepo
      .createQueryBuilder('e')
      .select('COALESCE(SUM(e.montant), 0)', 'total')
      .where('e.membre_id = :membreId', { membreId })
      .andWhere('e.type = :type', { type: TypeEcriture.FONDS_CAISSE })
      .getRawOne<{ total: string }>();
    return Number(resultat?.total ?? 0);
  }

  /** Alias `retirableDuMois` demandé par le contexte (= retirable calculé). */
  async retirableDuMois(membreId: number): Promise<number> {
    const vue = await this.trouverMoi(membreId);
    return vue.retirable;
  }
}
