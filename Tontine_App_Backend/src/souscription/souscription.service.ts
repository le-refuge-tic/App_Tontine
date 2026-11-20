import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { StatutSouscription } from '../common/enums';
import { Souscription } from './entities/souscription.entity';
import { Cycle } from '../cycle/entities/cycle.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { CreerSouscriptionDto } from './dto/creer-souscription.dto';
import { DemanderChangementDto } from './dto/demander-changement.dto';
import { UpdateSouscriptionDto } from './dto/update-souscription.dto';
import {
  aujourdhuiBenin,
  decomposerISO,
  formatISO,
  moisSuivant,
  nombreJoursMois,
} from '../common/utils/dates.util';
import { construireCycle } from '../common/utils/cycle.util';

@Injectable()
export class SouscriptionService {
  constructor(
    @InjectRepository(Souscription)
    private readonly souscriptionRepo: Repository<Souscription>,
    @InjectRepository(Cycle) private readonly cycleRepo: Repository<Cycle>,
    @InjectRepository(Portefeuille)
    private readonly portefeuilleRepo: Repository<Portefeuille>,
    private readonly parametres: ParametreSystemeService,
  ) {}

  /**
   * Liste les souscriptions. Si membreId est fourni, filtre sur ce membre.
   * Un membre ne voit que les siennes ; l'admin voit tout (membreId absent).
   */
  findAll(membreId?: number): Promise<Souscription[]> {
    return membreId !== undefined
      ? this.souscriptionRepo.find({ where: { membre: { id: membreId } } })
      : this.souscriptionRepo.find();
  }

  /**
   * Renvoie une souscription. Si membreId est fourni, vérifie l'appartenance
   * et lève un 404 (jamais 403) si elle n'appartient pas au membre.
   */
  async findOne(id: number, membreId?: number): Promise<Souscription> {
    const souscription = await this.souscriptionRepo.findOne({
      where: { id },
      relations: { membre: true },
    });
    if (!souscription)
      throw new NotFoundException(`Souscription introuvable : ${id}.`);
    if (membreId !== undefined && souscription.membre.id !== membreId) {
      throw new NotFoundException(`Souscription introuvable : ${id}.`);
    }
    return souscription;
  }

  /** Renvoie la souscription active du membre (404 si aucune). */
  async trouverActive(membreId: number): Promise<Souscription> {
    const active = await this.souscriptionRepo.findOne({
      where: { membre: { id: membreId }, statut: StatutSouscription.ACTIVE },
    });
    if (!active) {
      throw new NotFoundException("Vous n'avez pas de souscription active.");
    }
    return active;
  }

  async update(
    id: number,
    dto: UpdateSouscriptionDto,
    membreId?: number,
  ): Promise<Souscription> {
    await this.findOne(id, membreId);
    await this.souscriptionRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number, membreId?: number): Promise<void> {
    await this.findOne(id, membreId);
    await this.souscriptionRepo.delete(id);
  }

  /**
   * Crée une souscription pour le membre connecté, son portefeuille s'il
   * n'existe pas, puis génère le premier cycle et ses jours — le tout dans une
   * seule transaction de base de données.
   *
   * Refuse si une souscription active existe déjà (409), ou si la mise est
   * inférieure à `mise_minimale` (400).
   */
  async creerPourMembre(
    membreId: number,
    dto: CreerSouscriptionDto,
  ): Promise<Souscription> {
    return this.souscriptionRepo.manager.transaction(async (manager) => {
      // ---- Contrôles préalables (hors écriture) ----
      const active = await manager.getRepository(Souscription).findOne({
        where: { membre: { id: membreId }, statut: StatutSouscription.ACTIVE },
      });
      if (active) {
        throw new ConflictException('Vous avez déjà une souscription active.');
      }

      const miseMinimale = await this.parametres
        .getNumber('mise_minimale')
        .catch(() => 200);
      // TODO(decision) : mise = tout entier >= mise_minimale, ou multiples de 500 uniquement ?
      if (dto.miseBase < miseMinimale) {
        throw new BadRequestException(
          `La mise de base doit être supérieure ou égale à ${miseMinimale} FCFA.`,
        );
      }

      // ---- Création de la souscription ----
      const sRepo = manager.getRepository(Souscription);
      const aujourdhui = aujourdhuiBenin();
      const dateDemarrage = formatISO(
        aujourdhui.annee,
        aujourdhui.mois,
        aujourdhui.jour,
      );
      const souscription = sRepo.create({
        miseBase: dto.miseBase,
        regularite: dto.regularite,
        dateDemarrage,
        statut: StatutSouscription.ACTIVE,
        prochaineMiseBase: null,
        prochaineRegularite: null,
        membre: { id: membreId },
      });
      const saved = await sRepo.save(souscription);

      // ---- Portefeuille s'il n'existe pas déjà ----
      const pRepo = manager.getRepository(Portefeuille);
      const portefeuilleExistant = await pRepo.findOne({
        where: { membre: { id: membreId } },
      });
      if (!portefeuilleExistant) {
        await pRepo.save(
          pRepo.create({
            soldeCotisation: 0,
            soldeEpargne: 0,
            soldeBloque: 0,
            membre: { id: membreId },
          }),
        );
      }

      // ---- Premier cycle et ses jours ----
      await this.genererCycle(saved.id, manager);

      return saved;
    });
  }

  /**
   * Demande un changement de mise et/ou de régularité sur la souscription active
   * du membre. Remplit `prochaineMiseBase` et/ou `prochaineRegularite` : aucun
   * effet sur le cycle en cours, appliqué à l'ouverture du cycle suivant.
   */
  async demanderChangement(
    membreId: number,
    dto: DemanderChangementDto,
  ): Promise<Souscription> {
    const souscription = await this.trouverActive(membreId);
    if (dto.miseBase === undefined && dto.regularite === undefined) {
      throw new BadRequestException(
        'Au moins une valeur (mise ou régularité) doit être fournie.',
      );
    }

    if (dto.miseBase !== undefined) {
      const miseMinimale = await this.parametres
        .getNumber('mise_minimale')
        .catch(() => 200);
      if (dto.miseBase < miseMinimale) {
        throw new BadRequestException(
          `La mise de base doit être supérieure ou égale à ${miseMinimale} FCFA.`,
        );
      }
      souscription.prochaineMiseBase = dto.miseBase;
    }
    if (dto.regularite !== undefined) {
      souscription.prochaineRegularite = dto.regularite;
    }
    return this.souscriptionRepo.save(souscription);
  }

  /**
   * Génère le cycle suivant d'une souscription, dans une transaction.
   *
   * - Applique le changement demandé (`prochaineMiseBase` / `prochaineRegularite`)
   *   à la souscription puis les vide : la mise et la régularité sont figées
   *   à l'ouverture du cycle.
   * - `numero` = rang du cycle (précédent + 1, ou 1 pour le premier).
   * - Cycle 1 : du jour de démarrage au dernier jour du mois de démarrage.
   *   Cycle suivant : du 1er au dernier jour du mois suivant la fin du précédent.
   * - `fondsCaisseRetenu` du cycle = sa `miseBase` (plafond prévu ; aucune
   *   écriture de fonds de caisse n'est créée ici).
   *
   * Idempotent par la contrainte unique `(souscription, numero)`.
   */
  async genererCycle(
    souscriptionId: number,
    manager?: EntityManager,
  ): Promise<Cycle> {
    const run = async (m: EntityManager): Promise<Cycle> => {
      const sRepo = m.getRepository(Souscription);
      const cRepo = m.getRepository(Cycle);

      const souscription = await sRepo.findOne({
        where: { id: souscriptionId },
        relations: { membre: true },
      });
      if (!souscription) {
        throw new NotFoundException(
          `Souscription introuvable : ${souscriptionId}.`,
        );
      }

      // ---- Application du changement demandé (fige la mise/régularité) ----
      let miseBase = souscription.miseBase;
      let regularite = souscription.regularite;
      let modifiee = false;
      if (souscription.prochaineMiseBase !== null) {
        miseBase = souscription.prochaineMiseBase;
        souscription.miseBase = miseBase;
        souscription.prochaineMiseBase = null;
        modifiee = true;
      }
      if (souscription.prochaineRegularite !== null) {
        regularite = souscription.prochaineRegularite;
        souscription.regularite = regularite;
        souscription.prochaineRegularite = null;
        modifiee = true;
      }
      if (modifiee) {
        await sRepo.save(souscription);
      }

      // ---- Numéro et bornes du cycle ----
      const precedents = await cRepo.find({
        where: { souscription: { id: souscriptionId } },
        order: { numero: 'DESC' },
        take: 1,
      });
      const numero = precedents.length ? precedents[0].numero + 1 : 1;

      let dateDebut: string;
      let dateFin: string;
      if (numero === 1) {
        // TODO(decision) : inscription en milieu de mois. Comportement PROVISOIRE :
        //   le cycle 1 va du jour de démarrage au dernier jour du mois.
        const debut = decomposerISO(souscription.dateDemarrage);
        dateDebut = souscription.dateDemarrage;
        dateFin = formatISO(
          debut.annee,
          debut.mois,
          nombreJoursMois(debut.annee, debut.mois),
        );
      } else {
        const fin = decomposerISO(precedents[0].dateFin);
        const suiv = moisSuivant(fin.annee, fin.mois);
        dateDebut = formatISO(suiv.annee, suiv.mois, 1);
        dateFin = formatISO(
          suiv.annee,
          suiv.mois,
          nombreJoursMois(suiv.annee, suiv.mois),
        );
      }

      // ---- Construction et persistance (cascade insert des jours) ----
      const cycle = construireCycle({
        souscription,
        numero,
        dateDebut,
        dateFin,
        miseBase,
        regularite,
      });
      // TODO(decision) : fonds de caisse d'un NOUVEAU cycle — retenu à l'ouverture
      //   ou au premier dépôt. Ici on NE CRÉE PAS l'écriture de fonds de caisse :
      //   cela sera fait au prompt « Dépôts ». `cycle.fondsCaisseRetenu` est le
      //   plafond prévu, pas un montant réellement retenu.
      return cRepo.save(cycle);
    };

    return manager
      ? run(manager)
      : this.souscriptionRepo.manager.transaction(run);
  }
}
