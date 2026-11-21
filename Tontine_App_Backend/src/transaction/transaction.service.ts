import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { CaisseApplication } from '../caisse-application/entities/caisse-application.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { JourCotisation } from '../jour-cotisation/entities/jour-cotisation.entity';
import { Cycle } from '../cycle/entities/cycle.entity';
import type { IFedapayClient } from '../fedapay/fedapay-client.interface';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import {
  SensEcriture,
  SourceCaisse,
  StatutJourCotisation,
  StatutTransaction,
  TypeEcriture,
} from '../common/enums';
import { dateBeninISO } from '../common/utils/dates.util';
import { Inject } from '@nestjs/common';

export interface PageOptions {
  skip?: number;
  take?: number;
}

@Injectable()
export class TransactionService {
  private readonly logger = new Logger(TransactionService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly repo: Repository<Transaction>,
    @Inject(FEDAPAY_CLIENT)
    private readonly fedapayClient: IFedapayClient,
  ) {}

  findAll(membreId?: number, options?: PageOptions): Promise<Transaction[]> {
    return membreId !== undefined
      ? this.repo.find({
          where: { membre: { id: membreId } },
          skip: options?.skip,
          take: options?.take,
          order: { dateOperation: 'DESC' },
        })
      : this.repo.find({
          skip: options?.skip,
          take: options?.take,
          order: { dateOperation: 'DESC' },
        });
  }

  async findOne(id: number, membreId?: number): Promise<Transaction> {
    const t = await this.repo.findOne({
      where: { id },
      relations: { membre: true },
    });
    if (!t) throw new NotFoundException(`Transaction introuvable : ${id}.`);
    if (membreId !== undefined && t.membre.id !== membreId) {
      throw new NotFoundException(`Transaction introuvable : ${id}.`);
    }
    return t;
  }

  /**
   * Confirme une transaction approuvée par FedaPay. Doit être appelé dans une
   * transaction DB déjà ouverte (le webhook service en fournit une avec verrou
   * pessimiste). Effets :
   *
   * 1. Met le statut à `reussi` et relit les frais réels depuis FedaPay.
   * 2. Marque chaque jour ciblé comme payé (ou rattrapé s'il était perdu).
   * 3. Enregistre les écritures comptables (cotisation + fonds_caisse si premier
   *    dépôt du cycle).
   * 4. Recalcule le portefeuille du membre depuis le grand livre.
   */
  async confirmer(
    transactionId: number,
    manager: EntityManager,
  ): Promise<void> {
    const txRepo = manager.getRepository(Transaction);
    const transaction = await txRepo.findOne({
      where: { id: transactionId },
      relations: { membre: true },
    });
    if (!transaction) {
      throw new NotFoundException(
        `Transaction introuvable : ${transactionId}.`,
      );
    }

    // 1. Relire les frais réels depuis FedaPay.
    if (transaction.idFedapay) {
      try {
        const fedaTx = await this.fedapayClient.lireTransaction(
          transaction.idFedapay,
        );
        transaction.fraisFedapay = fedaTx.fees;
      } catch (err: unknown) {
        this.logger.warn(
          `Impossible de relire les frais FedaPay pour la transaction ${transactionId} : ${(err as Error).message}`,
        );
      }
    }
    transaction.statut = StatutTransaction.REUSSI;
    await txRepo.save(transaction);

    const membreId = transaction.membre.id;
    const jourIds = transaction.joursCibles ?? [];

    if (jourIds.length === 0) {
      await this.recalculerPortefeuille(membreId, manager);
      return;
    }

    // 2. Charger les jours avec leur cycle pour les regrouper.
    const jourRepo = manager.getRepository(JourCotisation);
    const jours = await jourRepo.find({
      where: jourIds.map((id) => ({ id })),
      relations: { cycle: true },
    });

    // Marquer chaque jour payé (ou rattrapé).
    for (const jour of jours) {
      const restant = jour.montantDu - jour.montantPaye;
      if (restant > 0) {
        await this.marquerPayeAvecManager(jour, restant, manager);
      }
    }

    // 3. Écritures comptables — grouper par cycle.
    const parCycle = new Map<number, JourCotisation[]>();
    for (const jour of jours) {
      const cycleId = jour.cycle.id;
      if (!parCycle.has(cycleId)) parCycle.set(cycleId, []);
      parCycle.get(cycleId)!.push(jour);
    }

    const ecritureRepo = manager.getRepository(EcritureComptable);
    const caisseRepo = manager.getRepository(CaisseApplication);
    const cycleRepo = manager.getRepository(Cycle);

    for (const [cycleId, joursduCycle] of parCycle) {
      const montantCotisation = joursduCycle.reduce(
        (s, j) => s + j.montantDu,
        0,
      );

      // Écriture cotisation (crédit).
      const ecritureCotisation = ecritureRepo.create({
        type: TypeEcriture.COTISATION,
        montant: montantCotisation,
        sens: SensEcriture.CREDIT,
        description: `Cotisation cycle ${cycleId}`,
        membre: { id: membreId },
        transaction: { id: transactionId },
        cycle: { id: cycleId },
        pret: null,
        remboursement: null,
      });
      await ecritureRepo.save(ecritureCotisation);

      // Fonds de caisse — au premier dépôt du cycle uniquement.
      const doitRetenir = await this.doitRetenirFondsCaisse(cycleId, manager);
      if (doitRetenir) {
        const cycle = await cycleRepo.findOne({ where: { id: cycleId } });
        if (cycle && cycle.fondsCaisseRetenu > 0) {
          const ecritureFonds = ecritureRepo.create({
            type: TypeEcriture.FONDS_CAISSE,
            montant: cycle.fondsCaisseRetenu,
            sens: SensEcriture.DEBIT,
            description: `Fonds de caisse cycle ${cycleId}`,
            membre: { id: membreId },
            transaction: { id: transactionId },
            cycle: { id: cycleId },
            pret: null,
            remboursement: null,
          });
          const savedFonds = await ecritureRepo.save(ecritureFonds);

          const caisse = caisseRepo.create({
            source: SourceCaisse.FONDS_CAISSE,
            montant: cycle.fondsCaisseRetenu,
            date: dateBeninISO(),
            ecritureComptable: savedFonds,
          });
          await caisseRepo.save(caisse);
        }
      }
    }

    // 4. Recalculer le portefeuille.
    await this.recalculerPortefeuille(membreId, manager);
  }

  /**
   * Passe le statut de la transaction à `echoue`.
   */
  async echouer(transactionId: number, manager: EntityManager): Promise<void> {
    await manager
      .getRepository(Transaction)
      .update(transactionId, { statut: StatutTransaction.ECHOUE });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Helpers privés
  // ─────────────────────────────────────────────────────────────────────────

  /** Met a jour le statut du jour avec le bon manager de transaction. */
  private async marquerPayeAvecManager(
    jour: JourCotisation,
    montant: number,
    manager: EntityManager,
  ): Promise<void> {
    const repo = manager.getRepository(JourCotisation);
    const etaitPerdu = jour.statut === StatutJourCotisation.PERDU;
    jour.montantPaye += montant;
    if (jour.montantPaye >= jour.montantDu) {
      jour.statut = etaitPerdu
        ? StatutJourCotisation.RATTRAPE
        : StatutJourCotisation.PAYE;
    }
    await repo.save(jour);
  }

  /**
   * Vérifie si le fonds de caisse doit être retenu pour ce cycle : true si
   * aucune écriture `fonds_caisse` n'existe encore pour ce cycle.
   *
   * TODO(decision) : comportement pour les cycles suivants. Provisoire : retenu
   * au premier dépôt uniquement.
   */
  private async doitRetenirFondsCaisse(
    cycleId: number,
    manager: EntityManager,
  ): Promise<boolean> {
    const count = await manager.getRepository(EcritureComptable).count({
      where: {
        type: TypeEcriture.FONDS_CAISSE,
        cycle: { id: cycleId },
      },
    });
    return count === 0;
  }

  /**
   * Recalcule le portefeuille du membre depuis le grand livre des écritures.
   *
   * - soldeCotisation = SUM(cotisation credit) − SUM(cotisation debit)
   * - soldeEpargne    = SUM(epargne credit) − SUM(epargne|retrait_epargne|penalite|retenue_epargne debit)
   * - soldeBloque     = SUM(gage_bloque credit) − SUM(gage_libere|gage_preleve debit)
   */
  private async recalculerPortefeuille(
    membreId: number,
    manager: EntityManager,
  ): Promise<void> {
    const eRepo = manager.getRepository(EcritureComptable);

    const rawResult = await eRepo
      .createQueryBuilder('e')
      .select(
        `COALESCE(SUM(CASE WHEN e.type = 'cotisation' AND e.sens = 'credit' THEN e.montant ELSE 0 END), 0)`,
        'coti_credit',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN e.type = 'cotisation' AND e.sens = 'debit' THEN e.montant ELSE 0 END), 0)`,
        'coti_debit',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN e.type = 'epargne' AND e.sens = 'credit' THEN e.montant ELSE 0 END), 0)`,
        'epargne_credit',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN e.type IN ('epargne','retrait_epargne','penalite','retenue_epargne') AND e.sens = 'debit' THEN e.montant ELSE 0 END), 0)`,
        'epargne_debit',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN e.type = 'gage_bloque' AND e.sens = 'credit' THEN e.montant ELSE 0 END), 0)`,
        'bloque_credit',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN e.type IN ('gage_libere','gage_preleve') AND e.sens = 'debit' THEN e.montant ELSE 0 END), 0)`,
        'bloque_debit',
      )
      .where('e.membre_id = :membreId', { membreId })
      .getRawOne<{
        coti_credit: string;
        coti_debit: string;
        epargne_credit: string;
        epargne_debit: string;
        bloque_credit: string;
        bloque_debit: string;
      }>();
    const soldeCotisation = Math.max(
      0,
      Number(rawResult?.coti_credit ?? 0) - Number(rawResult?.coti_debit ?? 0),
    );
    const soldeEpargne = Math.max(
      0,
      Number(rawResult?.epargne_credit ?? 0) -
        Number(rawResult?.epargne_debit ?? 0),
    );
    const soldeBloque = Math.max(
      0,
      Number(rawResult?.bloque_credit ?? 0) -
        Number(rawResult?.bloque_debit ?? 0),
    );
    await manager
      .getRepository(Portefeuille)
      .update(
        { membre: { id: membreId } },
        { soldeCotisation, soldeEpargne, soldeBloque },
      );
  }
}
