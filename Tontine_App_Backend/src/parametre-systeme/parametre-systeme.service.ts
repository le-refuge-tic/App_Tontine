import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ParametreSysteme } from './entities/parametre-systeme.entity';
import { CreateParametreSystemeDto } from './dto/create-parametre-systeme.dto';
import { UpdateParametreSystemeDto } from './dto/update-parametre-systeme.dto';

/**
 * Service des paramètres système. Expose `getNumber` et `getString` utilisés
 * par les autres services pour récupérer la configuration métier (mise minimale,
 * pénalité, multiplicateur de prêt, etc.).
 */
@Injectable()
export class ParametreSystemeService {
  constructor(
    @InjectRepository(ParametreSysteme)
    private readonly repo: Repository<ParametreSysteme>,
  ) {}

  findAll(): Promise<ParametreSysteme[]> {
    return this.repo.find();
  }

  async findOne(cle: string): Promise<ParametreSysteme> {
    const param = await this.repo.findOneBy({ cle });
    if (!param) {
      throw new NotFoundException(`Paramètre système introuvable : « ${cle} ».`);
    }
    return param;
  }

  create(dto: CreateParametreSystemeDto): Promise<ParametreSysteme> {
    const param = this.repo.create(dto);
    return this.repo.save(param);
  }

  async update(cle: string, dto: UpdateParametreSystemeDto): Promise<ParametreSysteme> {
    await this.repo.update(cle, dto);
    return this.findOne(cle);
  }

  async remove(cle: string): Promise<void> {
    await this.findOne(cle);
    await this.repo.delete(cle);
  }

  /**
   * Renvoie la valeur d'un paramètre convertie en nombre. Lève une erreur
   * claire si la clé est absente ou si la valeur n'est pas numérique.
   */
  async getNumber(cle: string): Promise<number> {
    const param = await this.repo.findOneBy({ cle });
    if (!param) {
      throw new Error(`Paramètre système introuvable : « ${cle} ».`);
    }
    const valeur = Number(param.valeur);
    if (Number.isNaN(valeur)) {
      throw new Error(
        `Le paramètre système « ${cle} » n'est pas numérique (valeur : « ${param.valeur} »).`,
      );
    }
    return valeur;
  }

  /**
   * Renvoie la valeur (chaîne) d'un paramètre. Lève une erreur claire si la
   * clé est absente.
   */
  async getString(cle: string): Promise<string> {
    const param = await this.repo.findOneBy({ cle });
    if (!param) {
      throw new Error(`Paramètre système introuvable : « ${cle} ».`);
    }
    return param.valeur;
  }
}
