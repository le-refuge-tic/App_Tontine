import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { JourCotisation } from './entities/jour-cotisation.entity';
import { StatutJourCotisation } from '../common/enums';
import { CreateJourCotisationDto } from './dto/create-jour-cotisation.dto';
import { UpdateJourCotisationDto } from './dto/update-jour-cotisation.dto';

@Injectable()
export class JourCotisationService {
  constructor(
    @InjectRepository(JourCotisation)
    private readonly repo: Repository<JourCotisation>,
  ) {}

  findAll(membreId?: number): Promise<JourCotisation[]> {
    return membreId !== undefined
      ? this.repo.find({
          where: { cycle: { souscription: { membre: { id: membreId } } } },
        })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<JourCotisation> {
    const jour = await this.repo.findOne({
      where: { id },
      relations: { cycle: { souscription: { membre: true } } },
    });
    if (!jour)
      throw new NotFoundException(`Jour de cotisation introuvable : ${id}.`);
    if (
      membreId !== undefined &&
      jour.cycle.souscription.membre.id !== membreId
    ) {
      throw new NotFoundException(`Jour de cotisation introuvable : ${id}.`);
    }
    return jour;
  }

  async create(dto: CreateJourCotisationDto): Promise<JourCotisation> {
    const jour = this.repo.create({
      numeroJour: dto.numeroJour,
      datePrevue: dto.datePrevue,
      coefficient: dto.coefficient,
      montantDu: dto.montantDu,
      montantPaye: dto.montantPaye,
      cycle: { id: dto.cycleId },
    });
    return this.repo.save(jour);
  }

  async update(
    id: number,
    dto: UpdateJourCotisationDto,
    membreId?: number,
  ): Promise<JourCotisation> {
    await this.findOne(id, membreId);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  /**
   * Marque un jour de cotisation comme (partiellement ou totalement) payé.
   *
   * - Ajoute `montant` à `montantPaye`.
   * - Passe le statut à `paye` dès que `montantPaye >= montantDu`, sauf si le
   *   jour était `perdu` : dans ce cas il passe à `rattrape`.
   * - Refuse un jour déjà payé ou rattrapé (pas de double paiement).
   * - Refuse un montant nul ou négatif.
   * - Si un `EntityManager` est fourni, utilise la transaction DB en cours.
   *
   * TODO(decision) : paiement partiel d'un jour. Pour l'instant on autorise
   * l'accumulation de paiements partiels (montantPaye augmente jusqu'à
   * montantDu). À confirmer : doit-on exiger le règlement intégral d'un jour
   * en une seule fois ?
   */
  async marquerPaye(
    jourId: number,
    montant: number,
    manager?: EntityManager,
  ): Promise<JourCotisation> {
    if (montant <= 0) {
      throw new BadRequestException(
        'Le montant du paiement doit être strictement positif.',
      );
    }
    const repo = manager ? manager.getRepository(JourCotisation) : this.repo;

    const jour = await repo.findOne({ where: { id: jourId } });
    if (!jour) {
      throw new NotFoundException(
        `Jour de cotisation introuvable : ${jourId}.`,
      );
    }
    if (
      jour.statut === StatutJourCotisation.PAYE ||
      jour.statut === StatutJourCotisation.RATTRAPE
    ) {
      throw new BadRequestException('Ce jour de cotisation est déjà payé.');
    }

    const etaitPerdu = jour.statut === StatutJourCotisation.PERDU;
    jour.montantPaye += montant;
    if (jour.montantPaye >= jour.montantDu) {
      jour.statut = etaitPerdu
        ? StatutJourCotisation.RATTRAPE
        : StatutJourCotisation.PAYE;
    }
    return repo.save(jour);
  }
}
