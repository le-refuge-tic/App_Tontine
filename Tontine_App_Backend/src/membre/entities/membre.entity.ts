import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Exclude } from 'class-transformer';
import { Role, StatutMembre } from '../../common/enums';
import { Portefeuille } from '../../portefeuille/entities/portefeuille.entity';
import { Souscription } from '../../souscription/entities/souscription.entity';
import { Transaction } from '../../transaction/entities/transaction.entity';
import { EcritureComptable } from '../../ecriture-comptable/entities/ecriture-comptable.entity';
import { Epargne } from '../../epargne/entities/epargne.entity';
import { Notification } from '../../notification/entities/notification.entity';
import { Pret } from '../../pret/entities/pret.entity';
import { Garantie } from '../../garantie/entities/garantie.entity';
import { JetonRafraichissement } from '../../jeton-rafraichissement/entities/jeton-rafraichissement.entity';

/**
 * Membre de la tontine. Le mot de passe et le code de retrait sont hachés
 * (bcrypt), jamais renvoyés (`select: false` sur les colonnes + `@Exclude`).
 * Les colonnes techniques d'anti-bruteforce sont aussi exclues des réponses.
 */
@Entity({ name: 'membres' })
export class Membre {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar', length: 100 })
  nom!: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  phone!: string;

  @Exclude()
  @Column({ type: 'varchar', select: false })
  password!: string;

  @Exclude()
  @Column({ type: 'varchar', nullable: true, select: false })
  codeRetrait!: string | null;

  @Column({ type: 'enum', enum: Role, default: Role.MEMBRE })
  role!: Role;

  @Column({ type: 'enum', enum: StatutMembre, default: StatutMembre.ACTIF })
  statut!: StatutMembre;

  @CreateDateColumn({ type: 'timestamptz' })
  dateInscription!: Date;

  // ---- Colonnes techniques anti-bruteforce (jamais dans les réponses) ----

  @Exclude()
  @Column({ type: 'int', default: 0 })
  tentativesConnexionEchouees!: number;

  @Exclude()
  @Column({ type: 'timestamptz', nullable: true })
  connexionBloqueeJusqua!: Date | null;

  @Exclude()
  @Column({ type: 'int', default: 0 })
  tentativesCodeRetraitEchouees!: number;

  @Exclude()
  @Column({ type: 'timestamptz', nullable: true })
  codeRetraitBloqueJusqua!: Date | null;

  // ---- Relations ----

  @OneToOne(() => Portefeuille, (p) => p.membre)
  portefeuille?: Portefeuille;

  @OneToMany(() => Souscription, (s) => s.membre)
  souscriptions!: Souscription[];

  @OneToMany(() => Transaction, (t) => t.membre)
  transactions!: Transaction[];

  @OneToMany(() => EcritureComptable, (e) => e.membre)
  ecrituresComptables!: EcritureComptable[];

  @OneToMany(() => Epargne, (e) => e.membre)
  epargnes!: Epargne[];

  @OneToMany(() => Notification, (n) => n.membre)
  notifications!: Notification[];

  /** Prêts dont le membre est l'emprunteur. */
  @OneToMany(() => Pret, (p) => p.emprunteur)
  prets!: Pret[];

  /** Garanties pour lesquelles le membre est témoin. */
  @OneToMany(() => Garantie, (g) => g.temoin)
  garanties!: Garantie[];

  @OneToMany(() => JetonRafraichissement, (j) => j.membre)
  jetonsRafraichissement!: JetonRafraichissement[];
}
