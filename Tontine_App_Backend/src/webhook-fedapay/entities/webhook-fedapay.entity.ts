import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

/**
 * Trace brute des appels reçus de FedaPay (webhooks). Aucune relation : seul le
 * payload brut est conservé pour traitement ultérieur.
 *
 * L'index unique partiel `idx_webhook_fedapay_ref_evenement` sur
 * `(idFedapayRef, evenement)` garantit l'idempotence : un même événement pour
 * une même transaction FedaPay ne peut être traité qu'une seule fois.
 */
@Entity({ name: 'webhooks_fedapay' })
@Index('idx_webhook_fedapay_ref_evenement', ['idFedapayRef', 'evenement'], {
  unique: true,
  where: '"id_fedapay_ref" IS NOT NULL',
})
export class WebhookFedapay {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: 'varchar' })
  evenement!: string;

  @Column({ type: 'jsonb' })
  payload!: Record<string, unknown>;

  @Column({ type: 'boolean', default: false })
  traite!: boolean;

  /** Identifiant FedaPay de la transaction concernée (pour l'idempotence). */
  @Column({ type: 'varchar', nullable: true })
  idFedapayRef!: string | null;

  @CreateDateColumn({ type: 'timestamptz' })
  date!: Date;
}
