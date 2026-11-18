import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cycle } from './entities/cycle.entity';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { UpdateCycleDto } from './dto/update-cycle.dto';

@Injectable()
export class CycleService {
  constructor(@InjectRepository(Cycle) private readonly cycleRepo: Repository<Cycle>) {}

  findAll(membreId?: number): Promise<Cycle[]> {
    return membreId !== undefined
      ? this.cycleRepo.find({ where: { souscription: { membre: { id: membreId } } } })
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

  async create(dto: CreateCycleDto): Promise<Cycle> {
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

  async update(id: number, dto: UpdateCycleDto, membreId?: number): Promise<Cycle> {
    await this.findOne(id, membreId);
    await this.cycleRepo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.cycleRepo.delete(id);
  }

  async cloturer(cycleId: number): Promise<void> {
    throw new NotImplementedException();
  }

  async rattraperJours(cycleId: number, jourIds: number[]): Promise<void> {
    throw new NotImplementedException();
  }
}
