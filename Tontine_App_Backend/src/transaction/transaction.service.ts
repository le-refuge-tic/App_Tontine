import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Transaction } from './entities/transaction.entity';

@Injectable()
export class TransactionService {
  constructor(@InjectRepository(Transaction) private readonly repo: Repository<Transaction>) {}

  findAll(membreId?: number): Promise<Transaction[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { membre: { id: membreId } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<Transaction> {
    const t = await this.repo.findOne({ where: { id }, relations: { membre: true } });
    if (!t) throw new NotFoundException(`Transaction introuvable : ${id}.`);
    if (membreId !== undefined && t.membre.id !== membreId) {
      throw new NotFoundException(`Transaction introuvable : ${id}.`);
    }
    return t;
  }

  async confirmer(transactionId: number): Promise<void> {
    // TODO(decision): frais FedaPay ajoutés au dépôt ou déduits.
    throw new NotImplementedException();
  }
}
