import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Instance d'une transaction FedaPay (retournée par create/retrieve). */
interface TransactionInstance {
  id: number;
  status: string;
  fees?: number;
  generateToken: () => Promise<{ token: string; url: string }>;
}

/** Instance d'un payout FedaPay (retournée par create/retrieve). */
interface PayoutInstance {
  id: number;
  status: string;
  fees?: number;
  amount_transferred?: number;
  sendNow: (opts?: Record<string, unknown>) => Promise<void>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const FedaPay = require('fedapay') as {
  FedaPay: {
    setApiKey: (k: string) => void;
    setEnvironment: (e: string) => void;
  };
  Transaction: {
    create: (data: Record<string, unknown>) => Promise<TransactionInstance>;
    retrieve: (id: number) => Promise<TransactionInstance>;
  };
  Payout: {
    create: (data: Record<string, unknown>) => Promise<PayoutInstance>;
    retrieve: (id: number) => Promise<PayoutInstance>;
  };
  Webhook: {
    constructEvent: (
      payload: Buffer,
      sigHeader: string,
      secret: string,
    ) => { name: string; object: Record<string, unknown> };
  };
};

import type {
  CreerPayoutParams,
  CreerTransactionParams,
  IFedapayClient,
  PayoutFedapay,
  ResultatCreerPayout,
  ResultatCreerTransaction,
  ResultatGenererLien,
  TransactionFedapay,
} from './fedapay-client.interface';
import { FedapayConfig } from '../config/configuration';

/** Timeout des appels HTTP vers FedaPay (ms). */
const TIMEOUT_MS = 15_000;

/**
 * Implémentation réelle du client FedaPay via le SDK officiel `fedapay`.
 * Ne logue jamais les clés secrètes.
 */
@Injectable()
export class FedapayClientImpl implements IFedapayClient {
  private readonly logger = new Logger(FedapayClientImpl.name);
  private readonly webhookSecret: string;

  constructor(config: ConfigService) {
    const fedapayConfig = config.get<FedapayConfig>('fedapay')!;
    this.webhookSecret = fedapayConfig.webhookSecret;

    FedaPay.FedaPay.setApiKey(fedapayConfig.secretKey);
    FedaPay.FedaPay.setEnvironment(fedapayConfig.env);
  }

  async creerTransaction(
    params: CreerTransactionParams,
  ): Promise<ResultatCreerTransaction> {
    const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);

    // Notre base stocke 2290197000000 (13 chiffres). On retire le préfixe "229"
    // pour obtenir les 10 chiffres locaux attendus par FedaPay.
    // TODO(verifier) : confirmer que FedaPay Bénin accepte bien les 10 chiffres locaux (0197000000).
    const phoneRaw = params.client.phone.replace(/^229/, '');

    const mots = params.client.nom.trim().split(/\s+/);
    const firstname = mots[0] ?? params.client.nom;
    const lastname = mots.slice(1).join(' ') || firstname;

    let instance: TransactionInstance;
    try {
      instance = await Promise.race([
        FedaPay.Transaction.create({
          description: params.description,
          amount: params.montant,
          currency: { iso: 'XOF' },
          callback_url: params.callbackUrl,
          customer: {
            firstname,
            lastname,
            phone_number: { number: phoneRaw, country: 'BJ' },
          },
        }),
        new Promise<never>((_, reject) =>
          timeoutSignal.addEventListener('abort', () =>
            reject(new Error('Timeout FedaPay creerTransaction')),
          ),
        ),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`FedaPay creerTransaction échoué : ${msg}`);
      throw err;
    }

    return { idFedapay: String(instance.id), statut: instance.status };
  }

  async genererLienPaiement(idFedapay: string): Promise<ResultatGenererLien> {
    const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);

    // generateToken() est une méthode d'instance — on récupère d'abord l'instance.
    let instance: TransactionInstance;
    try {
      instance = await Promise.race([
        FedaPay.Transaction.retrieve(Number(idFedapay)),
        new Promise<never>((_, reject) =>
          timeoutSignal.addEventListener('abort', () =>
            reject(new Error('Timeout FedaPay retrieve')),
          ),
        ),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`FedaPay retrieve échoué (id=${idFedapay}) : ${msg}`);
      throw err;
    }

    let token: { token: string; url: string };
    try {
      token = await Promise.race([
        instance.generateToken(),
        new Promise<never>((_, reject) =>
          timeoutSignal.addEventListener('abort', () =>
            reject(new Error('Timeout FedaPay generateToken')),
          ),
        ),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `FedaPay generateToken échoué (id=${idFedapay}) : ${msg}`,
      );
      throw err;
    }

    return { token: token.token, urlPaiement: token.url };
  }

  async lireTransaction(idFedapay: string): Promise<TransactionFedapay> {
    const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);

    let instance: TransactionInstance;
    try {
      instance = await Promise.race([
        FedaPay.Transaction.retrieve(Number(idFedapay)),
        new Promise<never>((_, reject) =>
          timeoutSignal.addEventListener('abort', () =>
            reject(new Error('Timeout FedaPay lireTransaction')),
          ),
        ),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `FedaPay lireTransaction échoué (id=${idFedapay}) : ${msg}`,
      );
      throw err;
    }

    return {
      idFedapay: String(instance.id),
      statut: instance.status,
      fees: instance.fees ?? 0,
    };
  }

  verifierSignatureWebhook(
    corpsBrut: Buffer,
    entete: string,
  ): { name: string; object: Record<string, unknown> } {
    try {
      return FedaPay.Webhook.constructEvent(
        corpsBrut,
        entete,
        this.webhookSecret,
      );
    } catch (err: unknown) {
      this.logger.warn('Signature webhook FedaPay invalide.');
      throw err;
    }
  }

  async creerEtEnvoyerPayout(
    params: CreerPayoutParams,
  ): Promise<ResultatCreerPayout> {
    const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);

    // Même logique que creerTransaction : retirer le préfixe 229 pour obtenir
    // les 10 chiffres locaux attendus par FedaPay.
    const phoneRaw = params.client.phone.replace(/^229/, '');

    const mots = params.client.nom.trim().split(/\s+/);
    const firstname = mots[0] ?? params.client.nom;
    const lastname = mots.slice(1).join(' ') || firstname;

    let payout: PayoutInstance;
    try {
      payout = await Promise.race([
        FedaPay.Payout.create({
          amount: params.montant,
          currency: { iso: 'XOF' },
          description: params.description,
          merchant_reference: params.referenceUnique,
          customer: {
            firstname,
            lastname,
            phone_number: { number: phoneRaw, country: 'BJ' },
          },
        }),
        new Promise<never>((_, reject) =>
          timeoutSignal.addEventListener('abort', () =>
            reject(new Error('Timeout FedaPay Payout.create')),
          ),
        ),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(`FedaPay Payout.create échoué : ${msg}`);
      throw err;
    }

    try {
      await Promise.race([
        payout.sendNow(),
        new Promise<never>((_, reject) =>
          timeoutSignal.addEventListener('abort', () =>
            reject(new Error('Timeout FedaPay payout.sendNow')),
          ),
        ),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `FedaPay payout.sendNow échoué (id=${payout.id}) : ${msg}`,
      );
      throw err;
    }

    return { idFedapayPayout: String(payout.id), statut: payout.status };
  }

  async lirePayout(idFedapayPayout: string): Promise<PayoutFedapay> {
    const timeoutSignal = AbortSignal.timeout(TIMEOUT_MS);

    let payout: PayoutInstance;
    try {
      payout = await Promise.race([
        FedaPay.Payout.retrieve(Number(idFedapayPayout)),
        new Promise<never>((_, reject) =>
          timeoutSignal.addEventListener('abort', () =>
            reject(new Error('Timeout FedaPay Payout.retrieve')),
          ),
        ),
      ]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `FedaPay lirePayout échoué (id=${idFedapayPayout}) : ${msg}`,
      );
      throw err;
    }

    return {
      idFedapayPayout: String(payout.id),
      statut: payout.status,
      fees: payout.fees ?? 0,
      amountTransferred: payout.amount_transferred ?? 0,
    };
  }
}
