import {
  Column,
  CreateDateColumn,
  Entity,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { TypeNotification } from '../../common/enums';
import { Membre } from '../../membre/entities/membre.entity';

/**
 * Notification envoyée à un membre (rappel de paiement, retrait effectué, etc.).
 */
@Entity({ name: 'notifications' })
export class Notification {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'enum', enum: TypeNotification })
  type!: TypeNotification;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'boolean', default: false })
  lue!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  date!: Date;

  @ManyToOne(() => Membre, (m) => m.notifications, {
    nullable: false,
    onDelete: 'RESTRICT',
  })
  membre!: Membre;
}
