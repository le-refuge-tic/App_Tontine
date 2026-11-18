import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Portefeuille } from './entities/portefeuille.entity';

@Injectable()
export class PortefeuilleService {
  constructor(@InjectRepository(Portefeuille) private readonly repo: Repository<Portefeuille>) {}

  findAll(membreId?: number): Promise<Portefeuille[]> {
    return membreId !== undefined
      ? this.repo.find({ where: { membre: { id: membreId } } })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<Portefeuille> {
    const p = await this.repo.findOne({ where: { id }, relations: { membre: true } });
    if (!p) throw new NotFoundException(`Portefeuille introuvable : ${id}.`);
    if (membreId !== undefined && p.membre.id !== membreId) {
      throw new NotFoundException(`Portefeuille introuvable : ${id}.`);
    }
    return p;
  }

  async retirableDuMois(membreId: number): Promise<number> {
    throw new NotImplementedException();
  }
}
