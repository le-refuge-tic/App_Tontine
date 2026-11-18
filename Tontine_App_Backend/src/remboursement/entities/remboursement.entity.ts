import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Pret } from '../../pret/entities/pret.entity';
import { EcritureComptable } from '../../ecriture-comptable/entities/ecriture-comptable.entity';

/**
 * Remboursement d'un prêt : génère une à plusieurs écritures comptables
 * (capital et intérêts).
 */
@Entity({ name: 'remboursements' })
export class Remboursement {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  montant!: number;

  @Column({ type: 'date' })
  date!: string;

  @ManyToOne(() => Pret, (p) => p.remboursements, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  pret!: Pret;

  @OneToMany(() => EcritureComptable, (e) => e.remboursement)
  ecrituresComptables!: EcritureComptable[];
}
