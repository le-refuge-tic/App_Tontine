import { Column, Entity, PrimaryColumn } from 'typeorm';

/**
 * Paramètre système (configuration métier). La clé primaire est la colonne
 * `cle` (chaîne), et non un entier auto-incrémenté. Les six paramètres du
 * métier sont insérés par le seed initial.
 */
@Entity({ name: 'parametres_systeme' })
export class ParametreSysteme {
  @PrimaryColumn()
  cle!: string;

  @Column({ type: 'varchar' })
  valeur!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;
}
