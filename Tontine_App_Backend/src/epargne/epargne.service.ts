import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Epargne } from './entities/epargne.entity';
import { CreateEpargneDto } from './dto/create-epargne.dto';
import { UpdateEpargneDto } from './dto/update-epargne.dto';

@Injectable()
export class EpargneService {
  constructor(@InjectRepository(Epargne) private readonly repo: Repository<Epargne>) {}

  findAll(membreId?: number): Promise<Epargne[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { membre: { id: membreId } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<Epargne> {
    const e = await this.repo.findOne({ where: { id }, relations: { membre: true } });
    if (!e) throw new NotFoundException(`Épargne introuvable : ${id}.`);
    if (membreId !== undefined && e.membre.id !== membreId) {
      throw new NotFoundException(`Épargne introuvable : ${id}.`);
    }
    return e;
  }

  async create(dto: CreateEpargneDto, membreId?: number): Promise<Epargne> {
    const epargne = this.repo.create({
      montant: dto.montant,
      dateEcheance: dto.dateEcheance,
      statut: dto.statut,
      membre: { id: membreId ?? dto.membreId },
    });
    return this.repo.save(epargne);
  }

  async update(id: number, dto: UpdateEpargneDto, membreId?: number): Promise<Epargne> {
    await this.findOne(id, membreId);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
