/**
 * Paramètres de création d'un payout FedaPay (virement sortant vers Mobile Money).
 */
export interface CreerPayoutParams {
  montant: number;
  description: string;
  /** Référence marchand unique (merchant_reference). */
  referenceUnique: string;
  client: {
    /** Nom complet du membre (prénom + nom). */
    nom: string;
    /** Numéro de téléphone complet du membre. */
    phone: string;
  };
}

export interface ResultatCreerPayout {
  /** Identifiant numérique FedaPay Payout converti en chaîne. */
  idFedapayPayout: string;
  /** Statut FedaPay au moment de la création (ex. 'pending'). */
  statut: string;
}

export interface PayoutFedapay {
  idFedapayPayout: string;
  /** 'pending' | 'started' | 'processing' | 'sent' | 'failed' */
  statut: string;
  /** Frais réels FedaPay (FCFA). */
  fees: number;
  /** Montant réellement transféré (FCFA). */
  amountTransferred: number;
}

/**
 * Paramètres de création d'une transaction FedaPay.
 */
export interface CreerTransactionParams {
  description: string;
  /** Montant en FCFA, entier strictement positif. */
  montant: number;
  /** URL de retour après paiement (callback FedaPay). */
  callbackUrl: string;
  client: {
    /** Nom complet du membre (prénom + nom). */
    nom: string;
    /** Numéro de téléphone complet du membre. */
    phone: string;
  };
}

export interface ResultatCreerTransaction {
  /** Identifiant numérique FedaPay converti en chaîne. */
  idFedapay: string;
  /** Statut FedaPay au moment de la création (ex. 'pending'). */
  statut: string;
}

export interface ResultatGenererLien {
  token: string;
  urlPaiement: string;
}

export interface TransactionFedapay {
  idFedapay: string;
  /** 'pending' | 'approved' | 'declined' | 'canceled' | 'transferred' */
  statut: string;
  /** Frais réels FedaPay (FCFA). */
  fees: number;
}

/**
 * Interface du client FedaPay. Implémentée par `FedapayClientImpl` (production)
 * et `FedapayClientFaux` (tests).
 */
export interface IFedapayClient {
  creerTransaction(
    params: CreerTransactionParams,
  ): Promise<ResultatCreerTransaction>;
  genererLienPaiement(idFedapay: string): Promise<ResultatGenererLien>;
  lireTransaction(idFedapay: string): Promise<TransactionFedapay>;
  /**
   * Crée un payout FedaPay et l'envoie immédiatement (`sendNow()`).
   */
  creerEtEnvoyerPayout(params: CreerPayoutParams): Promise<ResultatCreerPayout>;
  /**
   * Relit le statut d'un payout FedaPay.
   */
  lirePayout(idFedapayPayout: string): Promise<PayoutFedapay>;
  /**
   * Vérifie la signature HMAC du webhook et retourne l'événement parsé.
   * Lève une erreur si la signature est invalide.
   */
  verifierSignatureWebhook(
    corpsBrut: Buffer,
    entete: string,
  ): { name: string; object: Record<string, unknown> };
}

/** Token d'injection NestJS pour le client FedaPay. */
export const FEDAPAY_CLIENT = Symbol('FEDAPAY_CLIENT');
