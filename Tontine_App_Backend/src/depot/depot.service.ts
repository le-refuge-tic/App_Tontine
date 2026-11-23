import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import { CycleService } from '../cycle/cycle.service';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import type { IFedapayClient } from '../fedapay/fedapay-client.interface';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import { FedapayConfig } from '../config/configuration';
import { ConfigService } from '@nestjs/config';
import {
  StatutTransaction,
  StatutJourCotisation,
  TypeTransaction,
} from '../common/enums';
import { dateBeninISO } from '../common/utils/dates.util';
import { CreerDepotDto } from './dto/creer-depot.dto';

/** Résultat de la création d'un dépôt. */
export interface ResultatDepot {
  transaction: Transaction;
  /** URL de paiement FedaPay. Null si une transaction en attente a été réutilisée. */
  urlPaiement: string | null;
}

@Injectable()
export class DepotService {
  private readonly logger = new Logger(DepotService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Membre)
    private readonly membreRepo: Repository<Membre>,
    private readonly cycleService: CycleService,
    private readonly parametres: ParametreSystemeService,
    @Inject(FEDAPAY_CLIENT)
    private readonly fedapayClient: IFedapayClient,
    private readonly config: ConfigService,
  ) {}

  /**
   * Crée un dépôt FedaPay pour le membre.
   *
   * Flux :
   * 1. Calculer les jours à payer (aujourd'hui ou rattrapage).
   * 2. Anti double-clic (transaction en_attente identique < 10 min).
   * 3. Vérifier qu'aucun jour n'est déjà dans une transaction en_attente.
   * 4. Calculer les frais (paramètre système).
   * 5. Créer la Transaction en base.
   * 6. Appeler FedaPay → mettre à jour idFedapay.
   * 7. Générer le lien de paiement.
   */
  async creer(membreId: number, dto: CreerDepotDto): Promise<ResultatDepot> {
    // ---- 1. Jours à payer ----
    let jourIds: number[];
    let montant: number;

    if (dto.jourIds && dto.jourIds.length > 0) {
      // Rattrapage : valider et calculer via CycleService.
      const resultat = await this.cycleService.rattraperJours(
        dto.jourIds,
        membreId,
      );
      jourIds = resultat.jours.map((j) => j.id).sort((a, b) => a - b);
      montant = resultat.total;
    } else {
      // Dépôt du jour courant.
      const cycleEnCours = await this.cycleService.enCours(membreId);
      const aujourdhui = dateBeninISO();
      const jourAujourdhui = cycleEnCours.jours.find(
        (j) =>
          j.datePrevue === aujourdhui &&
          j.statut === StatutJourCotisation.A_PAYER,
      );
      if (!jourAujourdhui) {
        throw new BadRequestException(
          "Aucun jour de cotisation à payer aujourd'hui.",
        );
      }
      jourIds = [jourAujourdhui.id];
      montant = jourAujourdhui.montantDu - jourAujourdhui.montantPaye;
    }

    if (montant <= 0) {
      throw new BadRequestException('Le montant à payer est nul ou négatif.');
    }

    const jourIdsTries = [...jourIds].sort((a, b) => a - b);

    // ---- 2. Anti double-clic ----
    const dixMinutesAvant = new Date(Date.now() - 10 * 60 * 1000);
    const transactionsEnAttente = await this.txRepo.find({
      where: {
        membre: { id: membreId },
        statut: StatutTransaction.EN_ATTENTE,
        type: TypeTransaction.DEPOT,
      },
    });

    for (const tx of transactionsEnAttente) {
      if (tx.dateOperation >= dixMinutesAvant) {
        const ciblesTries = [...(tx.joursCibles ?? [])].sort((a, b) => a - b);
        if (JSON.stringify(ciblesTries) === JSON.stringify(jourIdsTries)) {
          this.logger.debug(
            `Double-clic détecté pour le membre ${membreId}, transaction ${tx.id}.`,
          );
          return { transaction: tx, urlPaiement: null };
        }
      }

      // Vérifier chevauchement de jours.
      const cibles = tx.joursCibles ?? [];
      const chevauchement = jourIdsTries.some((id) => cibles.includes(id));
      if (chevauchement) {
        throw new ConflictException(
          'Un ou plusieurs jours sont déjà inclus dans une transaction en cours.',
        );
      }
    }

    // ---- 3. Frais ----
    // TODO(decision) : frais ajoutés au montant à payer ou déduits du solde ?
    //   Comportement provisoire : ajoutés au montant.
    // TODO(verifier) : tarif réel FedaPay en sandbox.
    let pourcentageFrais = 0;
    try {
      pourcentageFrais = await this.parametres.getNumber(
        'pourcentage_frais_fedapay',
      );
    } catch {
      // Paramètre absent → pas de frais.
      pourcentageFrais = 0;
    }
    const fraisFedapay = calculerFrais(montant, pourcentageFrais);
    const montantTotal = montant + fraisFedapay;

    // ---- 4. Créer la Transaction en base ----
    const dateStr = dateBeninISO().replace(/-/g, '');
    const referenceUnique = `TX-${membreId}-${dateStr}-${randomUUID().slice(0, 8)}`;

    const membre = await this.membreRepo.findOneBy({ id: membreId });
    if (!membre) {
      throw new BadRequestException('Membre introuvable.');
    }

    const transaction = this.txRepo.create({
      type: TypeTransaction.DEPOT,
      montant: montantTotal,
      fraisFedapay,
      referenceUnique,
      idFedapay: null,
      statut: StatutTransaction.EN_ATTENTE,
      joursCibles: jourIdsTries,
      membre: { id: membreId },
    });
    const savedTx = await this.txRepo.save(transaction);

    // ---- 5. Appeler FedaPay ----
    const appPublicUrl =
      this.config.get<FedapayConfig>('fedapay')?.appPublicUrl ?? '';
    const callbackUrl = `${appPublicUrl}/api/v1/webhooks/fedapay`;

    let idFedapay: string;
    try {
      const resultat = await this.fedapayClient.creerTransaction({
        description: 'Cotisation Le Refuge',
        montant: montantTotal,
        callbackUrl,
        client: { nom: membre.nom, phone: membre.phone },
      });
      idFedapay = resultat.idFedapay;
    } catch (err: unknown) {
      this.logger.error(
        `Erreur FedaPay creerTransaction pour tx ${savedTx.id} : ${(err as Error).message}`,
      );
      savedTx.statut = StatutTransaction.ECHOUE;
      await this.txRepo.save(savedTx);
      throw new ServiceUnavailableException(
        'Service de paiement indisponible.',
      );
    }

    savedTx.idFedapay = idFedapay;
    await this.txRepo.save(savedTx);

    // Log temporaire : ID de transaction interne (pour simulation de webhook).
    this.logger.log(
      `Dépôt créé : transaction interne id=${savedTx.id}, idFedaPay=${idFedapay}, montant=${montantTotal} F`,
    );

    // ---- 6. Générer le lien de paiement ----
    let urlPaiement: string;
    try {
      const lien = await this.fedapayClient.genererLienPaiement(idFedapay);
      urlPaiement = lien.urlPaiement;
    } catch (err: unknown) {
      this.logger.error(
        `Erreur FedaPay genererLienPaiement pour tx ${savedTx.id} : ${(err as Error).message}`,
      );
      savedTx.statut = StatutTransaction.ECHOUE;
      await this.txRepo.save(savedTx);
      throw new ServiceUnavailableException(
        'Service de paiement indisponible.',
      );
    }

    return { transaction: savedTx, urlPaiement };
  }
}

/**
 * Calcule les frais FedaPay selon un pourcentage.
 * @param montant  Montant de base (FCFA, entier).
 * @param pourcentage  Pourcentage (ex. 1.5 pour 1,5 %).
 */
export function calculerFrais(montant: number, pourcentage: number): number {
  return Math.round((montant * pourcentage) / 100);
}
