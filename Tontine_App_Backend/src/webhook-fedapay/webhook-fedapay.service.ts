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
import { StatutTransaction, TypeTransaction } from '../common/enums';

/** Structure de réponse systématique du webhook. */
export interface ReponseWebhook {
  recu: boolean;
}

/** Résultat de traitement interne. */
interface ResultatTraitement {
  ignore: boolean;
  raison?: string;
}

/**
 * Événements de transaction FedaPay (dépôts).
 * TODO(verifier) : confirmer la liste exacte en sandbox.
 */
const EVENEMENTS_TRANSACTION = [
  'transaction.approved',
  'transaction.declined',
  'transaction.canceled',
] as const;

/**
 * Événements de payout FedaPay (retraits).
 * TODO(verifier) : noms exacts des événements payout FedaPay — non documentés
 * explicitement dans la doc webhook. Noms supposés : `payout.sent` et
 * `payout.failed`. À confirmer en sandbox.
 */
const EVENEMENTS_PAYOUT = ['payout.sent', 'payout.failed'] as const;

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

    // Parser le corps brut pour accéder à `entity` (structure réelle FedaPay).
    // Le SDK retourne event.object = "transaction" (le type en string) ;
    // les vraies données sont dans rawPayload.entity.
    let rawPayload: Record<string, unknown> = {};
    try {
      rawPayload = JSON.parse(rawBody.toString('utf8')) as Record<string, unknown>;
    } catch {
      // Corps non-JSON : on laisse rawPayload vide, l'extraction échouera proprement.
    }

    try {
      event = this.fedapayClient.verifierSignatureWebhook(rawBody, signature);
    } catch {
      this.logger.warn('Signature webhook FedaPay invalide — appel rejeté.');
      throw new UnauthorizedException('Signature invalide.');
    }

    const evenement = event.name;
    const payload = event.object;

    // Extraire idFedapayRef depuis rawPayload.entity (structure réelle FedaPay sandbox).
    const idFedapayRef = this.extraireIdFedapay(rawPayload);

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

    // Log du payload complet pour déboguer la structure FedaPay sandbox.
    this.logger.debug(
      `Webhook payload complet : ${JSON.stringify(payload)}`,
    );
    this.logger.log(
      `Webhook event.name="${evenement}" event.object type=${typeof payload} keys=${typeof payload === 'object' && payload !== null ? Object.keys(payload).join(',') : 'N/A'} raw=${JSON.stringify(payload).substring(0, 500)}`,
    );

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
   * Fonctionne pour les dépôts et les retraits (confirmer() est polymorphe).
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
    const tousEvenements = [
      ...EVENEMENTS_TRANSACTION,
      ...EVENEMENTS_PAYOUT,
    ] as string[];

    if (!tousEvenements.includes(evenement)) {
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

    // Aiguillage selon le type de transaction interne pour être robuste vis-à-vis
    // des noms d'événements payout non confirmés.
    // - Pour un DEPOT : événements transaction.approved / declined / canceled.
    // - Pour un RETRAIT : événements payout.sent / failed
    //   OU tout autre événement approuvé/refusé si FedaPay utilise d'autres noms.
    // TODO(verifier) : noms exacts des événements payout FedaPay en sandbox.

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

      const estApprouve = this.estEvenementApprouve(evenement, txLocked.type);
      const estRefuse = this.estEvenementRefuse(evenement, txLocked.type);

      if (estApprouve) {
        await this.transactionService.confirmer(transaction.id, manager);
      } else if (estRefuse) {
        await this.transactionService.echouer(transaction.id, manager);
      } else {
        this.logger.warn(
          `Webhook ${webhook.id} : événement ${evenement} inattendu pour type ${txLocked.type}.`,
        );
      }

      await manager
        .getRepository(WebhookFedapay)
        .update(webhook.id, { traite: true });
    });

    return { ignore: false };
  }

  /**
   * Détermine si un événement FedaPay signifie une approbation selon le type
   * de transaction interne.
   */
  private estEvenementApprouve(
    evenement: string,
    typeTransaction: TypeTransaction,
  ): boolean {
    if (typeTransaction === TypeTransaction.DEPOT) {
      return evenement === 'transaction.approved';
    }
    // RETRAIT (payout)
    return evenement === 'payout.sent';
  }

  /**
   * Détermine si un événement FedaPay signifie un refus selon le type
   * de transaction interne.
   */
  private estEvenementRefuse(
    evenement: string,
    typeTransaction: TypeTransaction,
  ): boolean {
    if (typeTransaction === TypeTransaction.DEPOT) {
      return (
        evenement === 'transaction.declined' ||
        evenement === 'transaction.canceled'
      );
    }
    // RETRAIT (payout)
    return evenement === 'payout.failed';
  }

  /**
   * Extrait l'identifiant FedaPay depuis le payload brut webhook.
   *
   * Structure réelle FedaPay sandbox (confirmée en test) :
   *   { "name": "transaction.approved", "object": "transaction", "entity": { "id": 548479, ... } }
   *
   * On lit entity.id en priorité, puis les fallbacks historiques.
   */
  private extraireIdFedapay(payload: Record<string, unknown>): string | null {
    // Structure réelle : entity.id
    const entity = payload['entity'] as Record<string, unknown> | undefined;
    if (entity && (typeof entity['id'] === 'number' || typeof entity['id'] === 'string')) {
      return String(entity['id']);
    }

    // Fallback : id à la racine
    if (typeof payload['id'] === 'number' || typeof payload['id'] === 'string') {
      return String(payload['id']);
    }

    // Fallback : transaction.id (ancienne structure supposée)
    const transaction = payload['transaction'] as Record<string, unknown> | undefined;
    if (transaction && (typeof transaction['id'] === 'number' || typeof transaction['id'] === 'string')) {
      return String(transaction['id']);
    }

    // Fallback : payout.id
    const payout = payload['payout'] as Record<string, unknown> | undefined;
    if (payout && (typeof payout['id'] === 'number' || typeof payout['id'] === 'string')) {
      return String(payout['id']);
    }

    return null;
  }
}
