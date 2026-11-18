import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SensEcriture, TypeEcriture } from '../../common/enums';
import { Membre } from '../../membre/entities/membre.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { Cycle } from '../../cycle/entities/cycle.entity';
import { Pret } from '../../pret/entities/pret.entity';
import { Remboursement } from '../../remboursement/entities/remboursement.entity';
import { CaisseApplication } from '../../caisse-application/entities/caisse-application.entity';

/**
 * Écriture comptable du grand livre : IMMUABLE. Une écriture ne se modifie ni
 * ne se supprime ; une erreur se corrige par une écriture inverse. Aucune route
 * PATCH ni DELETE.
 *
 * Une écriture est liée à un cycle, ou à un prêt, ou à aucun des deux, mais
 * jamais aux deux à la fois (contrainte CHECK en base).
 */
@Entity({ name: 'ecritures_comptables' })
@Check('"montant" > 0')
@Check('NOT ("cycle_id" IS NOT NULL AND "pret_id" IS NOT NULL)')
export class EcritureComptable {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: TypeEcriture })
  type!: TypeEcriture;

  @Column({ type: 'int' })
  montant!: number;

  @Column({ type: 'enum', enum: SensEcriture })
  sens!: SensEcriture;

  @Column({ type: 'varchar' })
  description!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  date!: Date;

  @ManyToOne(() => Membre, (m) => m.ecrituresComptables, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  membre!: Membre;

  @ManyToOne(() => Transaction, (t) => t.ecrituresComptables, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  transaction!: Transaction | null;

  @ManyToOne(() => Cycle, (c) => c.ecrituresComptables, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  cycle!: Cycle | null;

  @ManyToOne(() => Pret, (p) => p.ecrituresComptables, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  pret!: Pret | null;

  @ManyToOne(() => Remboursement, (r) => r.ecrituresComptables, {
    nullable: true,
    onDelete: 'RESTRICT',
  })
  remboursement!: Remboursement | null;

  /** Caisse d'application associée (côté inverse, optionnel). */
  @OneToOne(() => CaisseApplication, (c) => c.ecritureComptable)
  caisseApplication?: CaisseApplication;
}
