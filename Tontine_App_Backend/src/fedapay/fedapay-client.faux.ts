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

/**
 * Faux client FedaPay pour les tests Jest. Aucun appel reseau. L'etat interne
 * est controlable depuis les tests via les methodes definir*.
 */
export class FedapayClientFaux implements IFedapayClient {
  private _statut: string = 'pending';
  private _fees: number = 0;
  private _sigValid: boolean = true;
  private _idFedapay: string = '12345';

  private _statutPayout: string = 'pending';
  private _feesPayout: number = 0;
  private _idFedapayPayout: string = 'PO12345';

  definirStatut(s: string): void {
    this._statut = s;
  }

  definirFees(f: number): void {
    this._fees = f;
  }

  definirSignatureValide(v: boolean): void {
    this._sigValid = v;
  }

  definirIdFedapay(id: string): void {
    this._idFedapay = id;
  }

  definirStatutPayout(s: string): void {
    this._statutPayout = s;
  }

  definirFeesPayout(f: number): void {
    this._feesPayout = f;
  }

  definirIdFedapayPayout(id: string): void {
    this._idFedapayPayout = id;
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async creerTransaction(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _p: CreerTransactionParams,
  ): Promise<ResultatCreerTransaction> {
    return { idFedapay: this._idFedapay, statut: 'pending' };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async genererLienPaiement(id: string): Promise<ResultatGenererLien> {
    return {
      token: 'tok_test',
      urlPaiement: `https://sandbox.fedapay.com/pay/${id}`,
    };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async lireTransaction(id: string): Promise<TransactionFedapay> {
    return { idFedapay: id, statut: this._statut, fees: this._fees };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async creerEtEnvoyerPayout(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _params: CreerPayoutParams,
  ): Promise<ResultatCreerPayout> {
    return { idFedapayPayout: this._idFedapayPayout, statut: 'pending' };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async lirePayout(id: string): Promise<PayoutFedapay> {
    return {
      idFedapayPayout: id,
      statut: this._statutPayout,
      fees: this._feesPayout,
      amountTransferred: 0,
    };
  }

  verifierSignatureWebhook(
    corps: Buffer,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _entete: string,
  ): { name: string; object: Record<string, unknown> } {
    if (!this._sigValid) {
      throw new Error('Signature invalide');
    }
    const payload = JSON.parse(corps.toString()) as Record<string, unknown>;
    return {
      name: (payload['event'] as string) ?? 'transaction.approved',
      object: payload,
    };
  }
}
