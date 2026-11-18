import { Column, Entity, Index, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import { StatutGarantie } from '../../common/enums';
import { Pret } from '../../pret/entities/pret.entity';
import { Membre } from '../../membre/entities/membre.entity';

/**
 * Garantie (témoignage) d'un prêt : un témoin bloque un quart du prêt.
 * Un même témoin ne garantit un même prêt qu'une fois (unique pret + témoin).
 */
@Entity({ name: 'garanties' })
@Index('idx_garantie_pret_temoin', ['pret', 'temoin'], { unique: true })
export class Garantie {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int' })
  montantGage!: number;

  @Column({
    type: 'enum',
    enum: StatutGarantie,
    default: StatutGarantie.EN_ATTENTE,
  })
  statut!: StatutGarantie;

  @ManyToOne(() => Pret, (p) => p.garanties, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  pret!: Pret;

  @ManyToOne(() => Membre, (m) => m.garanties, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  temoin!: Membre;
}
