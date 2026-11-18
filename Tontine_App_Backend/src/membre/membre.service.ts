import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { ConfigService } from '@nestjs/config';
import { Membre } from './entities/membre.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { Role, StatutMembre } from '../common/enums';
import { UpdateMembreDto } from './dto/update-membre.dto';

/**
 * Service des membres. La création est assurée par AuthService (inscription).
 * Ce service expose les opérations CRUD protégées par rôles.
 */
@Injectable()
export class MembreService {
  constructor(
    @InjectRepository(Membre) private readonly membreRepo: Repository<Membre>,
    @InjectRepository(Portefeuille) private readonly portefeuilleRepo: Repository<Portefeuille>,
    private readonly config: ConfigService,
  ) {}

  findAll(): Promise<Membre[]> {
    return this.membreRepo.find();
  }

  async findOne(id: number): Promise<Membre> {
    const membre = await this.membreRepo.findOneBy({ id });
    if (!membre) {
      throw new NotFoundException(`Membre introuvable : ${id}.`);
    }
    return membre;
  }

  /**
   * Mise à jour partielle d'un membre. Ne touche pas au password ni au codeRetrait
   * (ces opérations passent par /auth/changer-password et /auth/code-retrait).
   * Le rôle et le statut ne sont pas modifiables ici (retirés de UpdateMembreDto).
   */
  async update(id: number, dto: UpdateMembreDto): Promise<Membre> {
    const payload: Partial<Membre> = {};
    if (dto.nom !== undefined) payload.nom = dto.nom;
    if (dto.phone !== undefined) payload.phone = dto.phone;
    await this.membreRepo.update(id, payload);
    return this.findOne(id);
  }

  async remove(id: number): Promise<void> {
    await this.findOne(id);
    await this.membreRepo.delete(id);
  }

  /**
   * Utilisé uniquement en interne (AuthService) pour créer l'admin via le seed
   * et pour l'inscription. Ne pas exposer dans le controller public.
   */
  async creerAvecPortefeuille(
    nom: string,
    phone: string,
    hashedPassword: string,
    role: Role = Role.MEMBRE,
    statut: StatutMembre = StatutMembre.ACTIF,
  ): Promise<Membre> {
    return this.membreRepo.manager.transaction(async (manager) => {
      const mRepo = manager.getRepository(Membre);
      const pRepo = manager.getRepository(Portefeuille);

      const membre = mRepo.create({ nom, phone, password: hashedPassword, role, statut });
      const saved = await mRepo.save(membre);

      await pRepo.save(pRepo.create({
        soldeCotisation: 0, soldeEpargne: 0, soldeBloque: 0, membre: saved,
      }));

      return saved;
    });
  }
}
