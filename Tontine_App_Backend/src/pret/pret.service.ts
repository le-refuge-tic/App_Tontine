import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Pret } from './entities/pret.entity';
import { Remboursement } from '../remboursement/entities/remboursement.entity';
import { CreatePretDto } from './dto/create-pret.dto';
import { UpdatePretDto } from './dto/update-pret.dto';

@Injectable()
export class PretService {
  constructor(@InjectRepository(Pret) private readonly repo: Repository<Pret>) {}

  findAll(membreId?: number): Promise<Pret[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { emprunteur: { id: membreId } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<Pret> {
    const pret = await this.repo.findOne({ where: { id }, relations: { emprunteur: true } });
    if (!pret) throw new NotFoundException(`Prêt introuvable : ${id}.`);
    if (membreId !== undefined && pret.emprunteur.id !== membreId) {
      throw new NotFoundException(`Prêt introuvable : ${id}.`);
    }
    return pret;
  }

  async create(dto: CreatePretDto, membreId?: number): Promise<Pret> {
    const pret = this.repo.create({
      montantTotal: dto.montantTotal,
      partEmprunteur: dto.partEmprunteur,
      montantARembourser: dto.montantARembourser,
      tauxInteret: dto.tauxInteret ?? null,
      dateDemande: dto.dateDemande,
      dateOctroi: dto.dateOctroi,
      emprunteur: { id: membreId ?? dto.emprunteurId },
    });
    return this.repo.save(pret);
  }

  async update(id: number, dto: UpdatePretDto, membreId?: number): Promise<Pret> {
    await this.findOne(id, membreId);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  async calculerPlafond(membreId: number): Promise<number> {
    throw new NotImplementedException();
  }

  async verifierEligibilite(membreId: number): Promise<boolean> {
    throw new NotImplementedException();
  }

  async accorder(pretId: number): Promise<Pret> {
    throw new NotImplementedException();
  }

  async enregistrerRemboursement(pretId: number, montant: number): Promise<Remboursement> {
    throw new NotImplementedException();
  }

  async declarerImpaye(pretId: number): Promise<void> {
    // TODO(decision): règle de prélèvement des gages en cas d'impayé non tranchée.
    throw new NotImplementedException();
  }
}
