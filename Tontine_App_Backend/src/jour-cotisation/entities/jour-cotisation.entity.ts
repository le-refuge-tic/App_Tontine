import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StatutJourCotisation } from '../../common/enums';
import { Cycle } from '../../cycle/entities/cycle.entity';

/**
 * Jour de cotisation d'un cycle (rang du jour dans le mois, 1 à 31).
 * La somme des coefficients d'un cycle vaut toujours 31.
 */
@Entity({ name: 'jours_cotisation' })
@Index('idx_jour_cycle_numero', ['cycle', 'numeroJour'], { unique: true })
export class JourCotisation {
  @PrimaryGeneratedColumn()
  id!: number;

  /** Rang du jour dans le mois (1 à 31). */
  @Column({ type: 'int' })
  numeroJour!: number;

  @Column({ type: 'date' })
  datePrevue!: string;

  @Column({ type: 'int', default: 1 })
  coefficient!: number;

  @Column({ type: 'int' })
  montantDu!: number;

  @Column({ type: 'int', default: 0 })
  montantPaye!: number;

  @Column({
    type: 'enum',
    enum: StatutJourCotisation,
    default: StatutJourCotisation.A_PAYER,
  })
  statut!: StatutJourCotisation;

  @ManyToOne(() => Cycle, (c) => c.jourCotisations, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  cycle!: Cycle;
}
