import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Remboursement } from './entities/remboursement.entity';
import { CreateRemboursementDto } from './dto/create-remboursement.dto';
import { UpdateRemboursementDto } from './dto/update-remboursement.dto';

@Injectable()
export class RemboursementService {
  constructor(@InjectRepository(Remboursement) private readonly repo: Repository<Remboursement>) {}

  findAll(membreId?: number): Promise<Remboursement[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { pret: { emprunteur: { id: membreId } } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<Remboursement> {
    const r = await this.repo.findOne({
      where: { id },
      relations: { pret: { emprunteur: true } },
    });
    if (!r) throw new NotFoundException(`Remboursement introuvable : ${id}.`);
    if (membreId !== undefined && r.pret.emprunteur.id !== membreId) {
      throw new NotFoundException(`Remboursement introuvable : ${id}.`);
    }
    return r;
  }

  async create(dto: CreateRemboursementDto): Promise<Remboursement> {
    const r = this.repo.create({ montant: dto.montant, date: dto.date, pret: { id: dto.pretId } });
    return this.repo.save(r);
  }

  async update(id: number, dto: UpdateRemboursementDto, membreId?: number): Promise<Remboursement> {
    await this.findOne(id, membreId);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }
}
