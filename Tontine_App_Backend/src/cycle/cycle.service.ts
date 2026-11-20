import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, In, LessThan, Repository } from 'typeorm';
import { Cycle } from './entities/cycle.entity';
import { JourCotisation } from '../jour-cotisation/entities/jour-cotisation.entity';
import { SouscriptionService } from '../souscription/souscription.service';
import {
  StatutCycle,
  StatutJourCotisation,
  StatutSouscription,
} from '../common/enums';
import { dateBeninISO } from '../common/utils/dates.util';
import { calculerProchaineEcheance } from '../common/utils/cycle.util';

/** Clé (bigint) du verrou advisory PostgreSQL protégeant la clôture des cycles. */
const CLE_ADVISORY_CLOTURE = 0x7c7c; // 31868 — verrou global du job de clôture

/** Résumé d'une exécution de clôture des cycles échus. */
export interface ResumeCloture {
  cyclesClotures: number;
}

@Injectable()
export class CycleService {
  private readonly logger = new Logger(CycleService.name);

  constructor(
    @InjectRepository(Cycle) private readonly cycleRepo: Repository<Cycle>,
    @InjectRepository(JourCotisation)
    private readonly jourRepo: Repository<JourCotisation>,
    private readonly souscriptions: SouscriptionService,
  ) {}

  findAll(membreId?: number): Promise<Cycle[]> {
    return membreId !== undefined
      ? this.cycleRepo.find({
          where: { souscription: { membre: { id: membreId } } },
        })
      : this.cycleRepo.find();
  }

  async findOne(id: number, membreId?: number): Promise<Cycle> {
    const cycle = await this.cycleRepo.findOne({
      where: { id },
      relations: { souscription: { membre: true } },
    });
    if (!cycle) throw new NotFoundException(`Cycle introuvable : ${id}.`);
    if (membreId !== undefined && cycle.souscription.membre.id !== membreId) {
      throw new NotFoundException(`Cycle introuvable : ${id}.`);
    }
    return cycle;
  }

  /**
   * Cycle en cours du membre connecté, avec ses jours et la prochaine échéance.
   * 404 propre s'il n'y a pas de souscription active ou aucun cycle en cours.
   */
  async enCours(membreId: number) {
    const souscription = await this.souscriptions.trouverActive(membreId);
    const cycle = await this.cycleRepo.findOne({
      where: {
        souscription: { id: souscription.id },
        statut: StatutCycle.EN_COURS,
      },
      relations: { jourCotisations: true },
      order: { numero: 'DESC' },
    });
    if (!cycle) {
      throw new NotFoundException("Aucun cycle en cours pour l'instant.");
    }

    const jours = (cycle.jourCotisations ?? [])
      .slice()
      .sort((a, b) => a.numeroJour - b.numeroJour)
      .map((j) => ({
        id: j.id,
        numeroJour: j.numeroJour,
        datePrevue: j.datePrevue,
        coefficient: j.coefficient,
        montantDu: j.montantDu,
        montantPaye: j.montantPaye,
        statut: j.statut,
      }));

    const prochaineEcheance = calculerProchaineEcheance(
      cycle.jourCotisations ?? [],
      cycle.regularite,
      dateBeninISO(),
    );

    return {
      id: cycle.id,
      numero: cycle.numero,
      miseBase: cycle.miseBase,
      regularite: cycle.regularite,
      dateDebut: cycle.dateDebut,
      dateFin: cycle.dateFin,
      statut: cycle.statut,
      fondsCaisseRetenu: cycle.fondsCaisseRetenu,
      jours,
      prochaineEcheance,
    };
  }

  /**
   * Liste des jours « perdu » du membre, tous cycles confondus, avec leur
   * cycle et leur montant dû (pour l'écran de rattrapage).
   */
  async joursRattrapables(membreId: number) {
    const jours = await this.jourRepo.find({
      where: {
        statut: StatutJourCotisation.PERDU,
        cycle: { souscription: { membre: { id: membreId } } },
      },
      relations: { cycle: { souscription: true } },
      order: { datePrevue: 'ASC' },
    });
    return jours.map((j) => ({
      id: j.id,
      numeroJour: j.numeroJour,
      datePrevue: j.datePrevue,
      coefficient: j.coefficient,
      montantDu: j.montantDu,
      montantPaye: j.montantPaye,
      statut: j.statut,
      cycle: {
        id: j.cycle.id,
        numero: j.cycle.numero,
        dateDebut: j.cycle.dateDebut,
        dateFin: j.cycle.dateFin,
      },
    }));
  }

  /**
   * Vérifie qu'un ensemble de jours est rattrapable par le membre connecté et
   * calcule le total à payer côté serveur. Ne touche à aucun argent : le
   * paiement et le passage au statut « rattrape » se feront au prompt Dépôts.
   *
   * Rattrapables : jours « perdu », ou « à payer » déjà échus (date prévue
   * strictement avant aujourd'hui).
   */
  async rattraperJours(
    jourIds: number[],
    membreId: number,
  ): Promise<{ jours: JourCotisation[]; total: number }> {
    const aujourdhui = dateBeninISO();
    const jours = await this.jourRepo.find({
      where: { id: In(jourIds) },
      relations: { cycle: { souscription: { membre: true } } },
    });
    if (jours.length !== jourIds.length) {
      throw new NotFoundException(
        'Un ou plusieurs jours de cotisation sont introuvables.',
      );
    }

    for (const jour of jours) {
      if (jour.cycle.souscription.membre.id !== membreId) {
        // Jamais 403 : on ne révèle pas l'existence d'un jour d'autrui.
        throw new NotFoundException(
          'Un ou plusieurs jours de cotisation sont introuvables.',
        );
      }
      const estPerdu = jour.statut === StatutJourCotisation.PERDU;
      const estAPayerEchu =
        jour.statut === StatutJourCotisation.A_PAYER &&
        jour.datePrevue < aujourdhui;
      if (!estPerdu && !estAPayerEchu) {
        throw new BadRequestException(
          `Le jour ${jour.numeroJour} n'est pas rattrapable (déjà payé ou non échu).`,
        );
      }
    }

    const total = jours.reduce((s, j) => s + (j.montantDu - j.montantPaye), 0);
    return { jours, total };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Clôture automatique
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Tâche planifiée quotidienne à 00:05, fuseau Africa/Porto-Novo. Clôture tous
   * les cycles échus, génère le cycle suivant pour les souscriptions actives.
   */
  @Cron('5 0 * * *', {
    timeZone: 'Africa/Porto-Novo',
    name: 'cloture-cycles-echus',
    waitForCompletion: true,
  })
  async tacheClotureQuotidienne(): Promise<void> {
    try {
      const resume = await this.cloturerEchus();
      if (resume.cyclesClotures > 0) {
        this.logger.log(
          `Clôture : ${resume.cyclesClotures} cycle(s) clôturé(s).`,
        );
      }
    } catch (erreur: unknown) {
      this.logger.error(
        `Échec de la clôture des cycles : ${(erreur as Error).message}`,
      );
    }
  }

  /**
   * Clôture tous les cycles « en cours » dont la date de fin est strictement
   * antérieure à aujourd'hui, puis génère le cycle suivant pour les
   * souscriptions actives. Rattrape plusieurs jours de retard d'un coup.
   *
   * Idempotent : un verrou advisory PostgreSQL (transactionnel) empêche deux
   * exécutions concurrentes, et la contrainte unique `(souscription, numero)`
   * garantit qu'aucun cycle n'est créé en double.
   */
  async cloturerEchus(): Promise<ResumeCloture> {
    const aujourdhui = dateBeninISO();
    let clotures = 0;

    await this.cycleRepo.manager.transaction(async (manager) => {
      // Verrou global du job : une seule exécution à la fois, même en double cron.
      await manager.query('SELECT pg_advisory_xact_lock($1)', [
        CLE_ADVISORY_CLOTURE,
      ]);

      // Boucle de rattrapage : traite les cycles échus un par un. En cas de
      // retard de plusieurs mois, un cycle suivant généré peut lui-même être
      // échu et sera clôturé au tour suivant.

      while (true) {
        const echu = await manager.getRepository(Cycle).findOne({
          where: {
            statut: StatutCycle.EN_COURS,
            dateFin: LessThan(aujourdhui),
          },
          relations: { souscription: true },
          order: { dateDebut: 'ASC' },
        });
        if (!echu) break;

        await this.cloturerCycleEnCours(echu, manager);
        if (echu.souscription.statut === StatutSouscription.ACTIVE) {
          await this.souscriptions.genererCycle(echu.souscription.id, manager);
        }
        clotures += 1;
      }
    });

    return { cyclesClotures: clotures };
  }

  /**
   * Clôture un cycle « en cours » : passe son statut à « terminé » et tous ses
   * jours « à payer » à « perdu » (les jours payés ou rattrapés le restent).
   */
  private async cloturerCycleEnCours(
    cycle: Cycle,
    manager: EntityManager,
  ): Promise<void> {
    await manager
      .getRepository(JourCotisation)
      .createQueryBuilder()
      .update()
      .set({
        statut: StatutJourCotisation.PERDU,
      })
      .where('cycle_id = :cycleId', { cycleId: cycle.id })
      .andWhere('statut = :statut', { statut: StatutJourCotisation.A_PAYER })
      .execute();
    await manager
      .getRepository(Cycle)
      .update(cycle.id, { statut: StatutCycle.TERMINE });
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  CRUD admin (inchangé)
  // ─────────────────────────────────────────────────────────────────────────

  async create(
    dto: import('./dto/create-cycle.dto').CreateCycleDto,
  ): Promise<Cycle> {
    const cycle = this.cycleRepo.create({
      numero: dto.numero,
      miseBase: dto.miseBase,
      regularite: dto.regularite,
      dateDebut: dto.dateDebut,
      dateFin: dto.dateFin,
      fondsCaisseRetenu: dto.fondsCaisseRetenu,
      souscription: { id: dto.souscriptionId },
    });
    return this.cycleRepo.save(cycle);
  }

  async update(
    id: number,
    dto: import('./dto/update-cycle.dto').UpdateCycleDto,
    membreId?: number,
  ): Promise<Cycle> {
    await this.findOne(id, membreId);
    await this.cycleRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.cycleRepo.delete(id);
  }
}
