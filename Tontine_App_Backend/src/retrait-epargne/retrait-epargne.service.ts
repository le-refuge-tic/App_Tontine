import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { RetraitEpargne } from './entities/retrait-epargne.entity';
import { CreateRetraitEpargneDto } from './dto/create-retrait-epargne.dto';
import { UpdateRetraitEpargneDto } from './dto/update-retrait-epargne.dto';

@Injectable()
export class RetraitEpargneService {
  constructor(@InjectRepository(RetraitEpargne) private readonly repo: Repository<RetraitEpargne>) {}

  findAll(membreId?: number): Promise<RetraitEpargne[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { epargne: { membre: { id: membreId } } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<RetraitEpargne> {
    const r = await this.repo.findOne({
      where: { id },
      relations: { epargne: { membre: true } },
    });
    if (!r) throw new NotFoundException(`Retrait d'épargne introuvable : ${id}.`);
    if (membreId !== undefined && r.epargne.membre.id !== membreId) {
      throw new NotFoundException(`Retrait d'épargne introuvable : ${id}.`);
    }
    return r;
  }

  async create(dto: CreateRetraitEpargneDto): Promise<RetraitEpargne> {
    const retrait = this.repo.create({
      montant: dto.montant,
      tauxApplique: dto.tauxApplique,
      montantRetenu: dto.montantRetenu,
      epargne: { id: dto.epargneId },
      transaction: { id: dto.transactionId },
    });
    return this.repo.save(retrait);
  }

  async update(id: number, dto: UpdateRetraitEpargneDto, membreId?: number): Promise<RetraitEpargne> {
    await this.findOne(id, membreId);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
