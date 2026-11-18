import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Trace brute des appels reçus de FedaPay (webhooks). Aucune relation : seul le
 * payload brut est conservé pour traitement ultérieur.
 */
@Entity({ name: 'webhooks_fedapay' })
export class WebhookFedapay {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  evenement!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  traite!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  date!: Date;
}
