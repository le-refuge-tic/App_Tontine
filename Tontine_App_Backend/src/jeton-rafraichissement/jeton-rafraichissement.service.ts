import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, LessThanOrEqual, Repository } from 'typeorm';
import * as crypto from 'crypto';
import { JetonRafraichissement } from './entities/jeton-rafraichissement.entity';

/**
 * Service de gestion des jetons de rafraîchissement.
 * Utilisé exclusivement par AuthService ; pas de controller.
 */
@Injectable()
export class JetonRafraichissementService {
  constructor(
    @InjectRepository(JetonRafraichissement)
    private readonly repo: Repository<JetonRafraichissement>,
  ) {}

  /** Calcule le hash SHA-256 d'un jeton brut. */
  hash(jetonBrut: string): string {
    return crypto.createHash('sha256').update(jetonBrut).digest('hex');
  }

  /** Crée et persiste un jeton de rafraîchissement pour un membre. */
  async creer(membreId: number, jetonBrut: string, expireLe: Date): Promise<void> {
    const jeton = this.repo.create({
      hashJeton: this.hash(jetonBrut),
      expireLe,
      revoqueLe: null,
      membre: { id: membreId },
    });
    await this.repo.save(jeton);
  }

  /**
   * Cherche un jeton actif (non révoqué, non expiré) par son hash.
   * Renvoie null si introuvable, révoqué ou expiré.
   */
  async trouverActif(jetonBrut: string): Promise<JetonRafraichissement | null> {
    const hash = this.hash(jetonBrut);
    return this.repo.findOne({
      where: {
        hashJeton: hash,
        revoqueLe: IsNull(),
      },
      relations: { membre: true },
    });
  }

  /** Révoque un jeton (positionne revoqueLe = maintenant). */
  async revoquer(jetonBrut: string): Promise<void> {
    const hash = this.hash(jetonBrut);
    await this.repo.update({ hashJeton: hash }, { revoqueLe: new Date() });
  }

  /** Révoque TOUS les jetons actifs d'un membre (détection de vol). */
  async revoquerTousPourMembre(membreId: number): Promise<void> {
    await this.repo.update(
      { membre: { id: membreId }, revoqueLe: IsNull() },
      { revoqueLe: new Date() },
    );
  }

  /** Nettoie les jetons expirés depuis plus de 24 h (tâche de maintenance). */
  async purgerExpires(): Promise<void> {
    const limite = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await this.repo.delete({ expireLe: LessThanOrEqual(limite) });
  }
}
