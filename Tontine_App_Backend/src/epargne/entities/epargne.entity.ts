import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StatutEpargne } from '../../common/enums';
import { Membre } from '../../membre/entities/membre.entity';
import { RetraitEpargne } from '../../retrait-epargne/entities/retrait-epargne.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';

/**
 * Épargne d'un membre. Le retrait avant la date d'échéance entraîne une
 * pénalité ; à la date ou après, une retenue.
 */
@Entity({ name: 'epargnes' })
export class Epargne {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', default: 0 })
  montant!: number;

  @Column({ type: 'date' })
  dateEcheance!: string;

  @Column({ type: 'enum', enum: StatutEpargne, default: StatutEpargne.ACTIVE })
  statut!: StatutEpargne;

  @ManyToOne(() => Membre, (m) => m.epargnes, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  membre!: Membre;

  /** Retraits effectués sur cette épargne. */
  @OneToMany(() => RetraitEpargne, (r) => r.epargne)
  retraits!: RetraitEpargne[];

  /** Transactions FedaPay (dépôts et retraits) liées à cette épargne. */
  @OneToMany(() => Transaction, (t) => t.epargne)
  transactions!: Transaction[];
}
