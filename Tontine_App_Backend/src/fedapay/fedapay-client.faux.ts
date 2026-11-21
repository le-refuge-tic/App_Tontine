import type {
  CreerTransactionParams,
  IFedapayClient,
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
