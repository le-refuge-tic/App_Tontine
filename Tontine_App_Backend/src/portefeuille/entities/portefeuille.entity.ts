import {
  Check,
  Column,
  Entity,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Membre } from '../../membre/entities/membre.entity';

/**
 * Portefeuille d'un membre : soldes de cotisation, d'épargne et bloqué.
 * Tous les soldes sont des entiers (FCFA) et ne peuvent pas être négatifs.
 * Côté propriétaire de la relation OneToOne avec Membre (JoinColumn unique).
 */
@Entity({ name: 'portefeuilles' })
@Check('"solde_cotisation" >= 0')
@Check('"solde_epargne" >= 0')
@Check('"solde_bloque" >= 0')
export class Portefeuille {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', default: 0 })
  soldeCotisation!: number;

  @Column({ type: 'int', default: 0 })
  soldeEpargne!: number;

  @Column({ type: 'int', default: 0 })
  soldeBloque!: number;

  @OneToOne(() => Membre, (m) => m.portefeuille, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  @JoinColumn()
  membre!: Membre;
}
