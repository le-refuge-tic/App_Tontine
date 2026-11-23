import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Enregistrement d'un jeton de retrait consommé.
 * Garantit l'usage unique : un jti ne peut être utilisé qu'une seule fois,
 * même si le jeton JWT est encore dans sa fenêtre de validité de 5 minutes.
 */
@Entity({ name: 'jetons_retrait_consommes' })
export class JetonRetraitConsomme {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * Identifiant unique du jeton (claim `jti`).
   * Contrainte d'unicité : un jti ne peut être inséré qu'une fois.
   */
  @Column({ type: 'varchar', unique: true })
  jti!: string;

  /** Date d'expiration du jeton (pour permettre un nettoyage périodique). */
  @Column({ type: 'timestamptz' })
  expireLe!: Date;

  @CreateDateColumn({ type: 'timestamptz' })
  consommeLe!: Date;
}
