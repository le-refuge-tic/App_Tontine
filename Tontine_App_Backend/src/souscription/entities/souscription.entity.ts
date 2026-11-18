import {
  Column,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Regularite, StatutSouscription } from '../../common/enums';
import { Membre } from '../../membre/entities/membre.entity';
import { Cycle } from '../../cycle/entities/cycle.entity';

/**
 * Souscription d'un membre : engagement de cotisation (mise + régularité).
 *
 * Un membre ne peut avoir qu'une seule souscription `active` à la fois, garantie
 * par un index unique partiel (`where statut = 'active'`).
 */
@Entity({ name: 'souscriptions' })
@Index('idx_souscription_active_unique', ['membre'], {
  unique: true,
  where: "statut = 'active'",
})
export class Souscription {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  miseBase!: number;

  @Column({ type: 'enum', enum: Regularite })
  regularite!: Regularite;

  /** Prochaine mise de base demandée (prend effet au cycle suivant). */
  @Column({ type: 'int', nullable: true })
  prochaineMiseBase!: number | null;

  /** Prochaine régularité demandée (prend effet au cycle suivant). */
  @Column({ type: 'enum', enum: Regularite, nullable: true })
  prochaineRegularite!: Regularite | null;

  @Column({ type: 'date' })
  dateDemarrage!: string;

  @Column({ type: 'enum', enum: StatutSouscription, default: StatutSouscription.ACTIVE })
  statut!: StatutSouscription;

  @ManyToOne(() => Membre, (m) => m.souscriptions, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  membre!: Membre;

  @OneToMany(() => Cycle, (c) => c.souscription)
  cycles!: Cycle[];
}
