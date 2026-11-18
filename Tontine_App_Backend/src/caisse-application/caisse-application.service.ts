import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CaisseApplication } from './entities/caisse-application.entity';

/**
 * Service de la caisse d'application. Table d'argent : lecture seule ici. La
 * création se fait par les services métier internes, en lien avec une écriture
 * comptable.
 */
@Injectable()
export class CaisseApplicationService {
  constructor(
    @InjectRepository(CaisseApplication) private readonly repo: Repository<CaisseApplication>,
  ) {}

  findAll(): Promise<CaisseApplication[]> {
    return this.repo.find();
  }

  async findOne(id: number): Promise<CaisseApplication> {
    const caisse = await this.repo.findOneBy({ id });
    if (!caisse) {
      throw new NotFoundException(`Caisse d\u2019application introuvable : ${id}.`);
    }
    return caisse;
  }
}
