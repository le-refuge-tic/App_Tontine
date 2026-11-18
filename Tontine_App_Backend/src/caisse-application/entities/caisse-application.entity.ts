import {
  Check,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { SourceCaisse } from '../../common/enums';
import { EcritureComptable } from '../../ecriture-comptable/entities/ecriture-comptable.entity';

/**
 * Encaissement dans la caisse d'application (fonds de caisse, pénalité,
 * retenue d'épargne, intérêt). Liée de façon obligatoire et unique à une
 * écriture comptable (côté propriétaire). Création publique interdite.
 */
@Entity({ name: 'caisse_application' })
@Check('"montant" > 0')
export class CaisseApplication {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: SourceCaisse })
  source!: SourceCaisse;

  @Column({ type: 'int' })
  montant!: number;

  @Column({ type: 'date' })
  date!: string;

  @OneToOne(() => EcritureComptable, (e) => e.caisseApplication, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  ecritureComptable!: EcritureComptable;
}
