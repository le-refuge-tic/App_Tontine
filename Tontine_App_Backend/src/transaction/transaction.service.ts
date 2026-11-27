import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { CaisseApplication } from '../caisse-application/entities/caisse-application.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { JourCotisation } from '../jour-cotisation/entities/jour-cotisation.entity';
import { Cycle } from '../cycle/entities/cycle.entity';
import { Souscription } from '../souscription/entities/souscription.entity';
import { Epargne } from '../epargne/entities/epargne.entity';
import { NotificationService } from '../notification/notification.service';
import type { IFedapayClient } from '../fedapay/fedapay-client.interface';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import {
  SensEcriture,
  SourceCaisse,
  StatutCycle,
  StatutEpargne,
  StatutJourCotisation,
  StatutSouscription,
  StatutTransaction,
  TypeEcriture,
  TypeNotification,
  TypeTransaction,
} from '../common/enums';
import { dateBeninISO } from '../common/utils/dates.util';

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
    private readonly notificationService: NotificationService,
  ) { }

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
   * Confirme une transaction approuvée par FedaPay. Aiguille selon le type
   * d'opération :
   *
   * - Transaction liée à une épargne (`epargne` non null) :
   *     · RETRAIT → confirmerRetraitEpargne()
   *     · DEPOT   → confirmerDepotEpargne()
   * - Sinon (cotisation, comportement inchangé) :
   *     · RETRAIT → confirmerRetrait()
   *     · DEPOT   → confirmerDepot()
   *
   * L'aiguillage épargne/cotisation se fait sur la présence d'une épargne
   * liée (`transaction.epargne`), et non sur le `type` (les dépôts et retraits
   * d'épargne partagent les mêmes valeurs d'enum `depot`/`retrait` que la
   * cotisation).
   *
   * Idempotence : si la transaction n'est plus EN_ATTENTE (déjà REUSSI ou
   * ECHOUE), cette méthode retourne immédiatement sans aucune écriture ni
   * recalcul. Le verrou pessimiste est posé sur la ligne Transaction elle-même
   * afin que deux webhooks simultanés ne passent pas tous les deux.
   */
  async confirmer(
    transactionId: number,
    manager: EntityManager,
  ): Promise<void> {
    const txRepo = manager.getRepository(Transaction);

    // Verrou pessimiste + contrôle d'idempotence dans la même transaction DB.
    // Deux webhooks simultanés acquièrent le verrou l'un après l'autre ;
    // le second trouve statut !== EN_ATTENTE et sort sans rien faire.
    const transaction = await txRepo.findOne({
      where: { id: transactionId },
      lock: { mode: 'pessimistic_write' },
      relations: { membre: true, epargne: true, retraitEpargne: true },
    });
    if (!transaction) {
      throw new NotFoundException(
        `Transaction introuvable : ${transactionId}.`,
      );
    }

    // Idempotence : ne rien faire si la transaction n'est plus EN_ATTENTE.
    if (transaction.statut !== StatutTransaction.EN_ATTENTE) {
      return;
    }

    // Opération d'épargne ?
    if (transaction.epargne != null) {
      if (transaction.type === TypeTransaction.RETRAIT) {
        await this.confirmerRetraitEpargne(transaction, manager);
      } else {
        await this.confirmerDepotEpargne(transaction, manager);
      }
      return;
    }

    // Opération de cotisation (comportement existant, inchangé).
    if (transaction.type === TypeTransaction.RETRAIT) {
      await this.confirmerRetrait(transaction, manager);
    } else {
      await this.confirmerDepot(transaction, manager);
    }
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
  //  Confirmation d'un dépôt
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Confirme un dépôt approuvé par FedaPay. Effets :
   *
   * 1. Met le statut à `reussi` et relit les frais réels depuis FedaPay.
   * 2. Marque chaque jour ciblé comme payé (ou rattrapé s'il était perdu).
   * 3. Enregistre les écritures comptables (cotisation + fonds_caisse si premier
   *    dépôt du cycle).
   * 4. Recalcule le portefeuille du membre depuis le grand livre.
   */
  private async confirmerDepot(
    transaction: Transaction,
    manager: EntityManager,
  ): Promise<void> {
    const txRepo = manager.getRepository(Transaction);

    // 1. Relire les frais réels depuis FedaPay.
    if (transaction.idFedapay) {
      try {
        const fedaTx = await this.fedapayClient.lireTransaction(
          transaction.idFedapay,
        );
        transaction.fraisFedapay = fedaTx.fees;
      } catch (err: unknown) {
        this.logger.warn(
          `Impossible de relire les frais FedaPay pour la transaction ${transaction.id} : ${(err as Error).message}`,
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
        transaction: { id: transaction.id },
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
            transaction: { id: transaction.id },
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

  // ─────────────────────────────────────────────────────────────────────────
  //  Confirmation d'un retrait
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Confirme un retrait envoyé via FedaPay Payout. Effets :
   *
   * 1. Met le statut à `reussi` et relit les frais réels (lirePayout).
   * 2. Écriture grand livre : RETRAIT débit.
   * 3. Si retrait total :
   *    a. Écriture supplémentaire RETRAIT débit = soldeCotisation - montantRetrait.
   *    b. Clôturer la souscription active.
   *    c. Clôturer le cycle en cours (TERMINE).
   *    d. Passer les jours A_PAYER en PERDU.
   *    e. Notification RETRAIT_EFFECTUE.
   * 4. Recalculer le portefeuille.
   */
  private async confirmerRetrait(
    transaction: Transaction,
    manager: EntityManager,
  ): Promise<void> {
    const txRepo = manager.getRepository(Transaction);

    // 1. Relire les frais réels depuis FedaPay (Payout).
    if (transaction.idFedapay) {
      try {
        const payout = await this.fedapayClient.lirePayout(
          transaction.idFedapay,
        );
        transaction.fraisFedapay = payout.fees;
      } catch (err: unknown) {
        this.logger.warn(
          `Impossible de relire les frais payout FedaPay pour tx ${transaction.id} : ${(err as Error).message}`,
        );
      }
    }
    transaction.statut = StatutTransaction.REUSSI;
    await txRepo.save(transaction);

    const membreId = transaction.membre.id;
    const ecritureRepo = manager.getRepository(EcritureComptable);

    // 2. Écriture RETRAIT principale (débit du montant retiré).
    await ecritureRepo.save(
      ecritureRepo.create({
        type: TypeEcriture.RETRAIT,
        montant: transaction.montant,
        sens: SensEcriture.DEBIT,
        description: 'Retrait vers Mobile Money',
        membre: { id: membreId },
        transaction: { id: transaction.id },
        cycle: null,
        pret: null,
        remboursement: null,
      }),
    );

    // 3. Traitement spécifique au retrait total.
    if (transaction.estRetraitTotal) {
      // Écriture de libération des fonds de caisse (retrait total uniquement).
      // Le type LIBERATION_FONDS (débit) annule le résidu non retirable
      // (fondsCaisseRetenu). Montant exact = fondsCaisseRetenu du membre.
      // Résultat après recalculerPortefeuille :
      //   soldeCotisation = SUM(cotisation credit)
      //                   - SUM(retrait debit)        [= montant retrait]
      //                   - SUM(liberation_fonds debit) [= fondsCaisseRetenu]
      //                   = 0  ✓
      // Aucune ligne dans CaisseApplication : les fonds y sont déjà acquis.
      const fondsCaisseResult = await manager
        .getRepository(EcritureComptable)
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.montant), 0)', 'total')
        .where('e.membre_id = :membreId', { membreId })
        .andWhere('e.type = :type', { type: TypeEcriture.FONDS_CAISSE })
        .getRawOne<{ total: string }>();
      const fondsCaisseRetenu = Number(fondsCaisseResult?.total ?? 0);
      if (fondsCaisseRetenu > 0) {
        await ecritureRepo.save(
          ecritureRepo.create({
            type: TypeEcriture.LIBERATION_FONDS,
            montant: fondsCaisseRetenu,
            sens: SensEcriture.DEBIT,
            description:
              'Libération des fonds de caisse retenus (retrait total)',
            membre: { id: membreId },
            transaction: { id: transaction.id },
            cycle: null,
            pret: null,
            remboursement: null,
          }),
        );
      }
      // a. Clôturer la souscription active.
      await manager
        .getRepository(Souscription)
        .createQueryBuilder()
        .update()
        .set({ statut: StatutSouscription.CLOTUREE })
        .where('membre_id = :membreId AND statut = :statut', {
          membreId,
          statut: StatutSouscription.ACTIVE,
        })
        .execute();

      // b. Clôturer le cycle en cours lié à la souscription du membre.
      //    On cherche les cycles EN_COURS via la souscription du membre.
      const cyclesEnCours = await manager
        .getRepository(Cycle)
        .createQueryBuilder('c')
        .innerJoin('c.souscription', 's')
        .where('s.membre_id = :membreId', { membreId })
        .andWhere('c.statut = :statut', { statut: StatutCycle.EN_COURS })
        .getMany();

      for (const cycle of cyclesEnCours) {
        // c. Passer les jours A_PAYER en PERDU.
        await manager
          .getRepository(JourCotisation)
          .createQueryBuilder()
          .update()
          .set({ statut: StatutJourCotisation.PERDU })
          .where('cycle_id = :cycleId AND statut = :statut', {
            cycleId: cycle.id,
            statut: StatutJourCotisation.A_PAYER,
          })
          .execute();

        // b. Clôturer le cycle.
        await manager
          .getRepository(Cycle)
          .update(cycle.id, { statut: StatutCycle.TERMINE });
      }

      // e. Notification.
      try {
        await this.notificationService.create({
          membreId,
          type: TypeNotification.RETRAIT_EFFECTUE,
          message: `Votre retrait total de ${transaction.montant} FCFA a été effectué avec succès.`,
        });
      } catch (err: unknown) {
        this.logger.warn(
          `Impossible d'envoyer la notification de retrait total pour le membre ${membreId} : ${(err as Error).message}`,
        );
      }
    }

    // 4. Recalculer le portefeuille.
    await this.recalculerPortefeuille(membreId, manager);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Confirmation d'un dépôt d'épargne
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Confirme un dépôt d'épargne approuvé par FedaPay. Effets :
   *
   * 1. Capture les frais estimés (mémorisés sur `transaction.fraisFedapay` à
   *    la création), puis relit les frais réels depuis FedaPay (mise à jour
   *    informative uniquement sur la transaction).
   * 2. Écriture grand livre `epargne` (crédit) du montant demandé par le
   *    membre : `transaction.montant − fraisEstimés`. Cette valeur est fixe
   *    et indépendante des frais réels renvoyés par FedaPay, ce qui garantit
   *    que l'épargne reçoit toujours exactement le montant commandé.
   * 3. Met à jour `Epargne.montant` (cache, recalculable depuis le grand
   *    livre).
   * 4. Recalcule le portefeuille (`soldeEpargne` mis à jour).
   *
   * Pas de fonds de caisse sur un dépôt d'épargne.
   */
  private async confirmerDepotEpargne(
    transaction: Transaction,
    manager: EntityManager,
  ): Promise<void> {
    const txRepo = manager.getRepository(Transaction);

    // Capturer les frais estimés AVANT de relire les frais réels FedaPay :
    // le montant épargné doit être exactement `transaction.montant − fraisEstimés`
    // (= le montant demandé par le membre), quelle que soit la valeur réelle
    // renvoyée par FedaPay. Ainsi l'épargne reçoit toujours le montant commandé,
    // et les éventuels écarts entre frais estimés et frais réels n'affectent
    // que le champ informatif `fraisFedapay` sur la transaction.
    const fraisEstimes = transaction.fraisFedapay;
    const montantEpargne = Math.max(0, transaction.montant - fraisEstimes);

    // TODO(decision) : quand les frais réels FedaPay diffèrent des frais estimés,
    // l'application absorbe l'écart (provisoire). Le montant crédité à l'épargne
    // reste toujours `transaction.montant − fraisEstimés`, indépendamment des
    // frais réels renvoyés par FedaPay. Les frais réels ne sont mis à jour que
    // sur le champ informatif `fraisFedapay` de la transaction.

    // 1. Relire les frais réels depuis FedaPay (mise à jour informative uniquement).
    if (transaction.idFedapay) {
      try {
        const fedaTx = await this.fedapayClient.lireTransaction(
          transaction.idFedapay,
        );
        transaction.fraisFedapay = fedaTx.fees;
      } catch (err: unknown) {
        this.logger.warn(
          `Impossible de relire les frais FedaPay pour la transaction épargne ${transaction.id} : ${(err as Error).message}`,
        );
      }
    }
    transaction.statut = StatutTransaction.REUSSI;
    await txRepo.save(transaction);

    const membreId = transaction.membre.id;

    const ecritureRepo = manager.getRepository(EcritureComptable);

    if (montantEpargne > 0) {
      // 2. Écriture épargne (crédit), liée à la transaction, sans cycle ni prêt.
      await ecritureRepo.save(
        ecritureRepo.create({
          type: TypeEcriture.EPARGNE,
          montant: montantEpargne,
          sens: SensEcriture.CREDIT,
          description: 'Dépôt épargne',
          membre: { id: membreId },
          transaction: { id: transaction.id },
          cycle: null,
          pret: null,
          remboursement: null,
        }),
      );

      // 3. Mettre à jour Epargne.montant (cache du grand livre).
      if (transaction.epargne) {
        const epargneRepo = manager.getRepository(Epargne);
        const epargne = await epargneRepo.findOne({
          where: { id: transaction.epargne.id },
        });
        if (epargne) {
          epargne.montant += montantEpargne;
          // Renseigner objectifAtteintLe la première fois que le montant
          // atteint ou dépasse l'objectif. Ce champ ne se vide jamais.
          if (
            epargne.objectifAtteintLe == null &&
            epargne.montant >= epargne.objectifMontant
          ) {
            epargne.objectifAtteintLe = new Date();
          }
          await epargneRepo.save(epargne);
        }
      }
    }

    // 4. Recalculer le portefeuille.
    await this.recalculerPortefeuille(membreId, manager);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Confirmation d'un retrait d'épargne
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Confirme un retrait d'épargne envoyé via FedaPay Payout. Effets, dans une
   * seule transaction DB :
   *
   * 1. Met le statut à `reussi` et relit les frais réels (lirePayout).
   * 2. Écriture `retrait_epargne` (débit) du montant net versé au membre.
   * 3. Écriture de pénalité (si retrait anticipé, 5 %) ou de retenue (si à
   *    échéance, 2,75 %) (débit) du `montantRetenu` + ligne CaisseApplication
   *    de source correspondante, liée à cette écriture.
   * 4. Diminue `Epargne.montant` de (net + retenue) ; si le solde tombe à 0,
   *    passe le statut à `retiree`.
   * 5. Recalcule le portefeuille.
   *
   * La somme des deux écritures (net + retenue) = montant demandé − frais.
   * Avec `pourcentage_frais_retrait = 0` (défaut), cette somme = montant
   * demandé (cf. invariant du prompt : retrait 10 000 → 9 500 + 500).
   * Aucune écriture n'est créée avant le succès webhook.
   */
  private async confirmerRetraitEpargne(
    transaction: Transaction,
    manager: EntityManager,
  ): Promise<void> {
    const txRepo = manager.getRepository(Transaction);

    // 1. Relire les frais réels depuis FedaPay (Payout).
    if (transaction.idFedapay) {
      try {
        const payout = await this.fedapayClient.lirePayout(
          transaction.idFedapay,
        );
        transaction.fraisFedapay = payout.fees;
      } catch (err: unknown) {
        this.logger.warn(
          `Impossible de relire les frais payout FedaPay pour la transaction épargne ${transaction.id} : ${(err as Error).message}`,
        );
      }
    }
    transaction.statut = StatutTransaction.REUSSI;
    await txRepo.save(transaction);

    const membreId = transaction.membre.id;
    const retraitEpargne = transaction.retraitEpargne;
    if (!retraitEpargne) {
      throw new Error(
        `RetraitEpargne manquant pour la transaction épargne ${transaction.id}.`,
      );
    }

    const montantRetenu = retraitEpargne.montantRetenu;
    // Montant net versé au membre, tel que calculé à la création.
    const montantNet = transaction.montant;
    const estAnticipe = retraitEpargne.estAnticipe;

    const ecritureRepo = manager.getRepository(EcritureComptable);
    const caisseRepo = manager.getRepository(CaisseApplication);

    // 2. Écriture retrait_epargne (débit, montant net versé).
    await ecritureRepo.save(
      ecritureRepo.create({
        type: TypeEcriture.RETRAIT_EPARGNE,
        montant: montantNet,
        sens: SensEcriture.DEBIT,
        description: 'Retrait épargne',
        membre: { id: membreId },
        transaction: { id: transaction.id },
        cycle: null,
        pret: null,
        remboursement: null,
      }),
    );

    // 3. Écriture pénalité ou retenue (débit, montant_retenu) + ligne caisse.
    if (montantRetenu > 0) {
      const typeRetenue = estAnticipe
        ? TypeEcriture.PENALITE
        : TypeEcriture.RETENUE_EPARGNE;
      const sourceRetenue = estAnticipe
        ? SourceCaisse.PENALITE
        : SourceCaisse.RETENUE_EPARGNE;
      const descriptionRetenue = estAnticipe
        ? 'Pénalité : objectif non atteint'
        : 'Retenue de tenue du fonds';

      const ecritureRetenue = ecritureRepo.create({
        type: typeRetenue,
        montant: montantRetenu,
        sens: SensEcriture.DEBIT,
        description: descriptionRetenue,
        membre: { id: membreId },
        transaction: { id: transaction.id },
        cycle: null,
        pret: null,
        remboursement: null,
      });
      const savedRetenue = await ecritureRepo.save(ecritureRetenue);

      await caisseRepo.save(
        caisseRepo.create({
          source: sourceRetenue,
          montant: montantRetenu,
          date: dateBeninISO(),
          ecritureComptable: savedRetenue,
        }),
      );
    }

    // 4. Diminuer Epargne.montant (net + retenue = montant demandé − frais).
    if (transaction.epargne) {
      const epargneRepo = manager.getRepository(Epargne);
      const epargne = await epargneRepo.findOne({
        where: { id: transaction.epargne.id },
      });
      if (epargne) {
        epargne.montant = Math.max(
          0,
          epargne.montant - (montantNet + montantRetenu),
        );
        if (epargne.montant === 0) {
          epargne.statut = StatutEpargne.RETIREE;
        }
        await epargneRepo.save(epargne);
      }
    }

    // 5. Recalculer le portefeuille.
    await this.recalculerPortefeuille(membreId, manager);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Helpers privés
  // ─────────────────────────────────────────────────────────────────────────

  /** Met à jour le statut du jour avec le bon manager de transaction. */
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
   *                     − SUM(retrait debit)
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
        `COALESCE(SUM(CASE WHEN e.type IN ('retrait','liberation_fonds') AND e.sens = 'debit' THEN e.montant ELSE 0 END), 0)`,
        'retrait_debit',
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
        retrait_debit: string;
        epargne_credit: string;
        epargne_debit: string;
        bloque_credit: string;
        bloque_debit: string;
      }>();

    const soldeCotisation = Math.max(
      0,
      Number(rawResult?.coti_credit ?? 0) -
      Number(rawResult?.coti_debit ?? 0) -
      Number(rawResult?.retrait_debit ?? 0),
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
