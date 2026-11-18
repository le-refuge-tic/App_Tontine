import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EcritureComptable } from './entities/ecriture-comptable.entity';
import { CreateEcritureComptableDto } from './dto/create-ecriture-comptable.dto';

@Injectable()
export class EcritureComptableService {
  constructor(@InjectRepository(EcritureComptable) private readonly repo: Repository<EcritureComptable>) {}

  findAll(membreId?: number): Promise<EcritureComptable[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { membre: { id: membreId } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<EcritureComptable> {
    const e = await this.repo.findOne({ where: { id }, relations: { membre: true } });
    if (!e) throw new NotFoundException(`Écriture comptable introuvable : ${id}.`);
    if (membreId !== undefined && e.membre.id !== membreId) {
      throw new NotFoundException(`Écriture comptable introuvable : ${id}.`);
    }
    return e;
  }

  async enregistrer(dto: CreateEcritureComptableDto): Promise<EcritureComptable> {
    throw new NotImplementedException();
  }
}
