import { Injectable, NotFoundException, NotImplementedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Garantie } from './entities/garantie.entity';
import { CreateGarantieDto } from './dto/create-garantie.dto';
import { UpdateGarantieDto } from './dto/update-garantie.dto';

@Injectable()
export class GarantieService {
  constructor(@InjectRepository(Garantie) private readonly repo: Repository<Garantie>) {}

  findAll(membreId?: number): Promise<Garantie[]> {
    // Un membre voit les garanties où il est emprunteur OU témoin.
    return membreId !== undefined
      ? this.repo.find({ where: [
          { pret: { emprunteur: { id: membreId } } },
          { temoin: { id: membreId } },
        ] })
      : this.repo.find();
  }

  async findOne(id: number, membreId?: number): Promise<Garantie> {
    const g = await this.repo.findOne({
      where: { id },
      relations: { pret: { emprunteur: true }, temoin: true },
    });
    if (!g) throw new NotFoundException(`Garantie introuvable : ${id}.`);
    if (membreId !== undefined &&
        g.pret.emprunteur.id !== membreId &&
        g.temoin.id !== membreId) {
      throw new NotFoundException(`Garantie introuvable : ${id}.`);
    }
    return g;
  }

  async create(dto: CreateGarantieDto): Promise<Garantie> {
    const g = this.repo.create({
      montantGage: dto.montantGage,
      statut: dto.statut,
      pret: { id: dto.pretId },
      temoin: { id: dto.temoinId },
    });
    return this.repo.save(g);
  }

  async update(id: number, dto: UpdateGarantieDto, membreId?: number): Promise<Garantie> {
    await this.findOne(id, membreId);
    await this.repo.update(id, dto);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.repo.delete(id);
  }

  async bloquer(garantieId: number): Promise<void> {
    throw new NotImplementedException();
  }

  async liberer(garantieId: number): Promise<void> {
    throw new NotImplementedException();
  }
}
