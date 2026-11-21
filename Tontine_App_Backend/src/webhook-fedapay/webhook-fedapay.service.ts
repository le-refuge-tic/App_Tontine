import {
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WebhookFedapay } from './entities/webhook-fedapay.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { TransactionService } from '../transaction/transaction.service';
import type { IFedapayClient } from '../fedapay/fedapay-client.interface';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import { StatutTransaction } from '../common/enums';

/** Structure de réponse systématique du webhook. */
export interface ReponseWebhook {
  recu: boolean;
}

/** Résultat de traitement interne. */
interface ResultatTraitement {
  ignore: boolean;
  raison?: string;
}

@Injectable()
export class WebhookFedapayService {
  private readonly logger = new Logger(WebhookFedapayService.name);

  constructor(
    @InjectRepository(WebhookFedapay)
    private readonly webhookRepo: Repository<WebhookFedapay>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    private readonly transactionService: TransactionService,
    @Inject(FEDAPAY_CLIENT)
    private readonly fedapayClient: IFedapayClient,
  ) {}

  findAll(): Promise<WebhookFedapay[]> {
    return this.webhookRepo.find();
  }

  async findOne(id: number): Promise<WebhookFedapay> {
    const webhook = await this.webhookRepo.findOneBy({ id });
    if (!webhook) {
      throw new NotFoundException(`Webhook FedaPay introuvable : ${id}.`);
    }
    return webhook;
  }

  /**
   * Traite un appel entrant de FedaPay.
   *
   * 1. Vérifie la signature HMAC.
   * 2. Idempotence : ignore si déjà traité.
   * 3. Enregistre en base.
   * 4. Traite l'événement dans une transaction DB avec verrou pessimiste.
   */
  async traiter(rawBody: Buffer, signature: string): Promise<ReponseWebhook> {
    // 1. Vérification de signature.
    let event: { name: string; object: Record<string, unknown> };
    try {
      event = this.fedapayClient.verifierSignatureWebhook(rawBody, signature);
    } catch {
      this.logger.warn('Signature webhook FedaPay invalide — appel rejeté.');
      throw new UnauthorizedException('Signature invalide.');
    }

    const evenement = event.name;
    const payload = event.object;

    // Extraire idFedapayRef depuis le payload.
    // TODO(verifier) : structure exacte du payload webhook FedaPay.
    //   Testé en sandbox : payload['id'] ou payload['transaction']['id'].
    const idFedapayRef = this.extraireIdFedapay(payload);

    // 2. Idempotence : vérifier si déjà traité.
    if (idFedapayRef) {
      const dejaTraite = await this.webhookRepo.findOne({
        where: {
          evenement,
          idFedapayRef,
          traite: true,
        },
      });
      if (dejaTraite) {
        this.logger.debug(
          `Webhook déjà traité : ${evenement} / idFedapay ${idFedapayRef}.`,
        );
        return { recu: true };
      }
    }

    // 3. Enregistrer en base.
    const webhook = this.webhookRepo.create({
      evenement,
      payload,
      traite: false,
      idFedapayRef,
    });
    const savedWebhook = await this.webhookRepo.save(webhook);

    // 4. Traitement métier.
    try {
      await this.traiterEvenement(
        savedWebhook,
        evenement,
        payload,
        idFedapayRef,
      );
    } catch (err: unknown) {
      this.logger.error(
        `Erreur lors du traitement webhook ${savedWebhook.id} (${evenement}) : ${(err as Error).message}`,
      );
      // On retourne quand même 200 pour éviter que FedaPay ne réessaie à l'infini.
    }

    return { recu: true };
  }

  /**
   * Traitement direct (dev uniquement) sans vérification de signature.
   * By-passe la signature mais passe par le même `confirmer()`/`echouer()`.
   */
  async traiterDirectement(
    transactionId: number,
    resultat: 'approuve' | 'refuse',
  ): Promise<ReponseWebhook> {
    await this.txRepo.manager.transaction(async (manager) => {
      const tx = await manager.getRepository(Transaction).findOne({
        where: { id: transactionId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!tx) {
        throw new NotFoundException(
          `Transaction introuvable : ${transactionId}.`,
        );
      }
      if (tx.statut === StatutTransaction.REUSSI) {
        return; // Idempotent.
      }
      if (resultat === 'approuve') {
        await this.transactionService.confirmer(transactionId, manager);
      } else {
        await this.transactionService.echouer(transactionId, manager);
      }
    });
    return { recu: true };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Helpers privés
  // ─────────────────────────────────────────────────────────────────────────

  private async traiterEvenement(
    webhook: WebhookFedapay,
    evenement: string,
    payload: Record<string, unknown>,
    idFedapayRef: string | null,
  ): Promise<ResultatTraitement> {
    const evenementsGeres = [
      'transaction.approved',
      'transaction.declined',
      'transaction.canceled',
    ];
    if (!evenementsGeres.includes(evenement)) {
      await this.webhookRepo.update(webhook.id, { traite: true });
      return { ignore: true, raison: 'Événement non géré.' };
    }

    if (!idFedapayRef) {
      this.logger.warn(
        `Webhook ${webhook.id} (${evenement}) sans idFedapay dans le payload.`,
      );
      await this.webhookRepo.update(webhook.id, { traite: true });
      return { ignore: true, raison: 'idFedapay absent du payload.' };
    }

    // Trouver la transaction interne par idFedapay.
    const transaction = await this.txRepo.findOne({
      where: { idFedapay: idFedapayRef },
      relations: { membre: true },
    });
    if (!transaction) {
      this.logger.warn(
        `Webhook ${webhook.id} : aucune transaction interne pour idFedapay ${idFedapayRef}.`,
      );
      await this.webhookRepo.update(webhook.id, { traite: true });
      return { ignore: true, raison: 'Transaction interne introuvable.' };
    }

    // Verrou pessimiste + transaction DB.
    await this.txRepo.manager.transaction(async (manager) => {
      const txLocked = await manager.getRepository(Transaction).findOne({
        where: { id: transaction.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!txLocked) return;

      // Idempotence.
      if (txLocked.statut === StatutTransaction.REUSSI) {
        await manager
          .getRepository(WebhookFedapay)
          .update(webhook.id, { traite: true });
        return;
      }

      if (evenement === 'transaction.approved') {
        await this.transactionService.confirmer(transaction.id, manager);
      } else {
        // declined ou canceled → échoue.
        await this.transactionService.echouer(transaction.id, manager);
      }

      await manager
        .getRepository(WebhookFedapay)
        .update(webhook.id, { traite: true });
    });

    return { ignore: false };
  }

  /**
   * Extrait l'identifiant FedaPay de la transaction depuis le payload webhook.
   * TODO(verifier) : structure exacte du payload webhook FedaPay en sandbox.
   *   Testé : `payload.id` ou `payload.transaction.id`.
   */
  private extraireIdFedapay(payload: Record<string, unknown>): string | null {
    if (
      typeof payload['id'] === 'number' ||
      typeof payload['id'] === 'string'
    ) {
      return String(payload['id']);
    }
    const transaction = payload['transaction'] as
      Record<string, unknown> | undefined;
    if (
      transaction &&
      (typeof transaction['id'] === 'number' ||
        typeof transaction['id'] === 'string')
    ) {
      return String(transaction['id']);
    }
    return null;
  }
}
