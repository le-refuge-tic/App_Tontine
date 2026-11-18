import {
  Column,
  Entity,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { StatutPret } from '../../common/enums';
import { NumericTransformer } from '../../common/transformers/numeric.transformer';
import { Membre } from '../../membre/entities/membre.entity';
import { Garantie } from '../../garantie/entities/garantie.entity';
import { Remboursement } from '../../remboursement/entities/remboursement.entity';
import { EcritureComptable } from '../../ecriture-comptable/entities/ecriture-comptable.entity';

/**
 * Prêt entre membres. L'emprunteur rembourse la part des témoins (3 x un quart)
 * avec intérêts. Le taux d'intérêt n'est pas encore décidé (nullable).
 */
@Entity({ name: 'prets' })
export class Pret {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  montantTotal!: number;

  @Column({ type: 'int' })
  partEmprunteur!: number;

  @Column({ type: 'int' })
  montantARembourser!: number;

  /** Taux d'intérêt (numeric 5,2) ; non encore décidé -> nullable. */
  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    nullable: true,
    transformer: NumericTransformer,
  })
  tauxInteret!: number | null;

  @Column({ type: 'enum', enum: StatutPret, default: StatutPret.DEMANDE })
  statut!: StatutPret;

  @Column({ type: 'date' })
  dateDemande!: string;

  @Column({ type: 'date', nullable: true })
  dateOctroi!: string | null;

  @ManyToOne(() => Membre, (m) => m.prets, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  emprunteur!: Membre;

  @OneToMany(() => Garantie, (g) => g.pret)
  garanties!: Garantie[];

  @OneToMany(() => Remboursement, (r) => r.pret)
  remboursements!: Remboursement[];

  @OneToMany(() => EcritureComptable, (e) => e.pret)
  ecrituresComptables!: EcritureComptable[];
}
