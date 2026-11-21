import {
  Check,
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StatutTransaction, TypeTransaction } from '../../common/enums';
import { Membre } from '../../membre/entities/membre.entity';
import { EcritureComptable } from '../../ecriture-comptable/entities/ecriture-comptable.entity';
import { RetraitEpargne } from '../../retrait-epargne/entities/retrait-epargne.entity';

/**
 * Transaction Mobile Money (dépôt / retrait). Création publique interdite :
 * elle se fait uniquement par les services métier internes.
 */
@Entity({ name: 'transactions' })
@Check('"montant" > 0')
export class Transaction {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: TypeTransaction })
  type!: TypeTransaction;

  @Column({ type: 'int' })
  montant!: number;

  @Column({ type: 'int', default: 0 })
  fraisFedapay!: number;

  @Column({ type: 'varchar', unique: true })
  referenceUnique!: string;

  @Column({ type: 'varchar', nullable: true, unique: true })
  idFedapay!: string | null;

  @Column({
    type: 'enum',
    enum: StatutTransaction,
    default: StatutTransaction.EN_ATTENTE,
  })
  statut!: StatutTransaction;

  /**
   * Identifiants des jours de cotisation ciblés par ce dépôt (jsonb).
   * Triés à l'écriture pour permettre la comparaison JSON anti-double-clic.
   */
  @Column({ type: 'jsonb', nullable: true })
  joursCibles!: number[] | null;

  @CreateDateColumn({ type: 'timestamptz' })
  dateOperation!: Date;

  @ManyToOne(() => Membre, (m) => m.transactions, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  membre!: Membre;

  @OneToMany(() => EcritureComptable, (e) => e.transaction)
  ecrituresComptables!: EcritureComptable[];

  /** Retrait d'épargne payé par cette transaction (côté inverse, optionnel). */
  @OneToOne(() => RetraitEpargne, (r) => r.transaction)
  retraitEpargne?: RetraitEpargne;
}
