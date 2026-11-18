import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JourCotisation } from './entities/jour-cotisation.entity';
import { CreateJourCotisationDto } from './dto/create-jour-cotisation.dto';
import { UpdateJourCotisationDto } from './dto/update-jour-cotisation.dto';

@Injectable()
export class JourCotisationService {
  constructor(@InjectRepository(JourCotisation) private readonly repo: Repository<JourCotisation>) {}

  findAll(membreId?: number): Promise<JourCotisation[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { cycle: { souscription: { membre: { id: membreId } } } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<JourCotisation> {
    const jour = await this.repo.findOne({
      where: { id },
      relations: { cycle: { souscription: { membre: true } } },
    });
    if (!jour) throw new NotFoundException(`Jour de cotisation introuvable : ${id}.`);
    if (membreId !== undefined && jour.cycle.souscription.membre.id !== membreId) {
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

  async update(id: number, dto: UpdateJourCotisationDto, membreId?: number): Promise<JourCotisation> {
    await this.findOne(id, membreId);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  async marquerPaye(jourId: number, montant: number): Promise<void> {
    throw new NotImplementedException();
  }
}
