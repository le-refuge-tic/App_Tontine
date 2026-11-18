import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';
import { Epargne } from '../../epargne/entities/epargne.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';

/**
 * Retrait d'épargne. Un retrait est payé par exactement une transaction
 * (relation OneToOne propriétaire, obligatoire et unique).
 */
@Entity({ name: 'retraits_epargne' })
export class RetraitEpargne {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  montant!: number;

  /** Taux appliqué au retrait (numeric 5,2, converti en number). */
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    transformer: NumericTransformer,
  })
  tauxApplique!: number;

  @Column({ type: 'int' })
  montantRetenu!: number;

  @ManyToOne(() => Epargne, (e) => e.retraits, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  epargne!: Epargne;

  @OneToOne(() => Transaction, (t) => t.retraitEpargne, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  transaction!: Transaction;
}
