import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { EcritureComptable } from './entities/ecriture-comptable.entity';
import { CreateEcritureComptableDto } from './dto/create-ecriture-comptable.dto';

@Injectable()
export class EcritureComptableService {
  constructor(
    @InjectRepository(EcritureComptable)
    private readonly repo: Repository<EcritureComptable>,
  ) {}

  findAll(membreId?: number): Promise<EcritureComptable[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { membre: { id: membreId } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<EcritureComptable> {
    const e = await this.repo.findOne({
      where: { id },
      relations: { membre: true },
    });
    if (!e)
      throw new NotFoundException(`Écriture comptable introuvable : ${id}.`);
    if (membreId !== undefined && e.membre.id !== membreId) {
      throw new NotFoundException(`Écriture comptable introuvable : ${id}.`);
    }
    return e;
  }

  /**
   * Enregistre une écriture comptable. Si un `EntityManager` est fourni, utilise
   * la transaction en cours (cas des dépôts/webhooks) ; sinon ouvre une nouvelle
   * transaction.
   */
  async enregistrer(
    dto: CreateEcritureComptableDto,
    manager?: EntityManager,
  ): Promise<EcritureComptable> {
    const repo = manager ? manager.getRepository(EcritureComptable) : this.repo;

    const ecriture = repo.create({
      type: dto.type,
      montant: dto.montant,
      sens: dto.sens,
      description: dto.description,
      membre: { id: dto.membreId },
      transaction: dto.transactionId ? { id: dto.transactionId } : null,
      cycle: dto.cycleId ? { id: dto.cycleId } : null,
      pret: dto.pretId ? { id: dto.pretId } : null,
      remboursement: dto.remboursementId ? { id: dto.remboursementId } : null,
    });
    return repo.save(ecriture);
  }
}
