import {
  BadRequestException,
  Injectable,
  NotFoundException,
  NotImplementedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Regularite, StatutSouscription } from '../common/enums';
import { Souscription } from './entities/souscription.entity';
import { Membre } from '../membre/entities/membre.entity';
import { Cycle } from '../cycle/entities/cycle.entity';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { CreateSouscriptionDto } from './dto/create-souscription.dto';
import { UpdateSouscriptionDto } from './dto/update-souscription.dto';

@Injectable()
export class SouscriptionService {
  constructor(
    @InjectRepository(Souscription) private readonly souscriptionRepo: Repository<Souscription>,
    @InjectRepository(Membre) private readonly membreRepo: Repository<Membre>,
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
    if (!souscription) throw new NotFoundException(`Souscription introuvable : ${id}.`);
    if (membreId !== undefined && souscription.membre.id !== membreId) {
      throw new NotFoundException(`Souscription introuvable : ${id}.`);
    }
    return souscription;
  }

  async create(dto: CreateSouscriptionDto): Promise<Souscription> {
    const membre = await this.membreRepo.findOneBy({ id: dto.membreId });
    if (!membre) throw new NotFoundException(`Membre introuvable : ${dto.membreId}.`);

    const active = await this.souscriptionRepo.findOne({
      where: { membre: { id: dto.membreId }, statut: StatutSouscription.ACTIVE },
    });
    if (active) throw new BadRequestException('Le membre a déjà une souscription active.');

    const miseMinimale = await this.parametres.getNumber('mise_minimale');
    if (dto.miseBase < miseMinimale) {
      throw new BadRequestException(
        `La mise de base doit être supérieure ou égale à ${miseMinimale} FCFA.`,
      );
    }

    const souscription = this.souscriptionRepo.create({
      miseBase: dto.miseBase,
      regularite: dto.regularite,
      dateDemarrage: dto.dateDemarrage,
      membre: { id: dto.membreId },
    });
    return this.souscriptionRepo.save(souscription);
  }

  async update(id: number, dto: UpdateSouscriptionDto, membreId?: number): Promise<Souscription> {
    await this.findOne(id, membreId);
    await this.souscriptionRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.souscriptionRepo.delete(id);
  }

  async demanderChangement(
    souscriptionId: number,
    miseBase?: number,
    regularite?: Regularite,
  ): Promise<void> {
    throw new NotImplementedException();
  }

  async genererCycle(souscriptionId: number): Promise<Cycle> {
    throw new NotImplementedException();
  }
}
