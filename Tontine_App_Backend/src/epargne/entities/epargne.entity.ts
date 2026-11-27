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
 * Épargne d'un membre.
 *
 * Depuis le prompt 7b :
 * - Il n'y a plus de date de fin : `dateEcheance` est nullable.
 * - `objectifMontant` est obligatoire (entier ≥ 1) : chaque membre fixe son
 *   propre objectif.
 * - `objectifAtteintLe` : horodatage (nullable) renseigné une seule fois quand
 *   `montant ≥ objectifMontant`. Ne se vide jamais, même après un retrait.
 *
 * Règle de taux au retrait :
 *   - Objectif atteint (objectifAtteintLe non null OU montant ≥ objectifMontant)
 *     → retenue_epargne_echeance (2,75 %), source retenue_epargne.
 *   - Objectif non atteint → penalite_epargne_anticipee (5 %), source penalite.
 */
@Entity({ name: 'epargnes' })
export class Epargne {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'int', default: 0 })
  montant!: number;

  /**
   * Date d'échéance — désormais nullable (plus de date de fin obligatoire).
   * Conservée pour compatibilité avec les données existantes ; ignorée dans
   * le calcul du taux de retrait.
   */
  @Column({ type: 'date', nullable: true, default: null })
  dateEcheance!: string | null;

  @Column({ type: 'enum', enum: StatutEpargne, default: StatutEpargne.ACTIVE })
  statut!: StatutEpargne;

  /**
   * Nom donné par le membre à ce projet d'épargne.
   * Défaut : 'Mon projet'. Modifiable via PATCH /epargnes/:id tant qu'aucun
   * dépôt n'a réussi.
   */
  @Column({ type: 'varchar', length: 100, default: 'Mon projet' })
  nom!: string;

  /**
   * Montant cible (FCFA, > 0). Obligatoire à la création (entier ≥ 1).
   * Modifiable via PATCH uniquement tant que montant = 0 et objectifAtteintLe
   * est null (aucun dépôt réussi).
   *
   * TODO(decision) : autoriser une hausse de l'objectif après dépôt ?
   */
  @Column({ type: 'int' })
  objectifMontant!: number;

  /**
   * Date et heure auxquelles l'objectif a été atteint pour la première fois
   * (montant ≥ objectifMontant lors de la confirmation d'un dépôt).
   * Null tant que l'objectif n'est pas atteint.
   * Ne se vide jamais, même après un retrait partiel.
   */
  @Column({ type: 'timestamptz', nullable: true, default: null })
  objectifAtteintLe!: Date | null;

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
