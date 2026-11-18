import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Regularite, StatutCycle } from '../../common/enums';
import { Souscription } from '../../souscription/entities/souscription.entity';
import { JourCotisation } from '../../jour-cotisation/entities/jour-cotisation.entity';
import { EcritureComptable } from '../../ecriture-comptable/entities/ecriture-comptable.entity';

/**
 * Cycle de cotisation : un mois calendaire de paiement (31 jours de paiement).
 * La mise et la régularité sont figées à l'ouverture du cycle.
 */
@Entity({ name: 'cycles' })
@Index('idx_cycle_souscription_numero', ['souscription', 'numero'], {
  unique: true,
})
export class Cycle {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  numero!: number;

  /** Mise de base figée à l'ouverture du cycle. */
  @Column({ type: 'int' })
  miseBase!: number;

  /** Régularité figée à l'ouverture du cycle. */
  @Column({ type: 'enum', enum: Regularite })
  regularite!: Regularite;

  @Column({ type: 'date' })
  dateDebut!: string;

  @Column({ type: 'date' })
  dateFin!: string;

  @Column({ type: 'int' })
  fondsCaisseRetenu!: number;

  @Column({ type: 'enum', enum: StatutCycle, default: StatutCycle.EN_COURS })
  statut!: StatutCycle;

  @ManyToOne(() => Souscription, (s) => s.cycles, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  souscription!: Souscription;

  /**
   * Jours de cotisation du cycle. Cascade d'insertion uniquement (jamais de
   * suppression en cascade) : la suppression d'un cycle reste interdite par
   * `onDelete: RESTRICT` côté enfant.
   */
  @OneToMany(() => JourCotisation, (j) => j.cycle, { cascade: ['insert'] })
  jourCotisations!: JourCotisation[];

  @OneToMany(() => EcritureComptable, (e) => e.cycle)
  ecrituresComptables!: EcritureComptable[];
}
