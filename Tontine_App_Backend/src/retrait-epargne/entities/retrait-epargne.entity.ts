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

  /**
   * Vrai si le retrait a lieu AVANT la date d'échéance (pénalité 5 %),
   * faux à la date ou après (retenue 2,75 %).
   *
   * Décidé à la création (comparaison `dateBeninISO() < dateEcheance`) et
   * mémorisé ici pour que la confirmation webhook choisisse le type d'écriture
   * (`penalite` vs `retenue_epargne`) de façon robuste, indépendamment d'une
   * éventuelle évolution des paramètres système entre-temps.
   */
  @Column({ type: 'boolean', default: false })
  estAnticipe!: boolean;

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
