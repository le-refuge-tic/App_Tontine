import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Membre } from '../../membre/entities/membre.entity';

/**
 * Jeton de rafraîchissement JWT (refresh token).
 * On ne stocke JAMAIS le jeton en clair : seul son hash SHA-256 est conservé.
 * La rotation révoque l'ancien jeton et émet un nouveau couple access+refresh.
 * La réutilisation d'un jeton révoqué déclenche la révocation de toute la famille.
 */
@Entity({ name: 'jetons_rafraichissement' })
export class JetonRafraichissement {
  @PrimaryGeneratedColumn()
  id!: number;

  /**
   * Hash SHA-256 du jeton de rafraîchissement. Jamais le jeton brut.
   * @Exclude : n'apparaît dans aucune réponse sérialisée.
   */
  @Exclude()
  @Column({ type: 'varchar', unique: true })
  hashJeton!: string;

  @Column({ type: 'timestamptz' })
  expireLe!: Date;

  /** Null tant que le jeton est actif ; renseigné à la révocation. */
  @Exclude()
  @Column({ type: 'timestamptz', nullable: true })
  revoqueLe!: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  creeLe!: Date;

  @ManyToOne(() => Membre, (m) => m.jetonsRafraichissement, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  membre!: Membre;
}
