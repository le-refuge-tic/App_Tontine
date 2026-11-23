import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { JetonRetraitConsomme } from '../jeton-retrait-consomme/entities/jeton-retrait-consomme.entity';
import type { IFedapayClient } from '../fedapay/fedapay-client.interface';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { JwtRetraitPayload } from '../auth/interfaces/jwt-payload.interface';
import {
  StatutTransaction,
  TypeEcriture,
  TypeTransaction,
} from '../common/enums';
import { dateBeninISO } from '../common/utils/dates.util';
import { CreerRetraitDto } from './dto/creer-retrait.dto';
import { calculerFrais } from '../depot/depot.service';

export interface ResultatRetrait {
  transaction: Transaction;
}

@Injectable()
export class RetraitService {
  private readonly logger = new Logger(RetraitService.name);

  constructor(
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Membre)
    private readonly membreRepo: Repository<Membre>,
    @InjectRepository(Portefeuille)
    private readonly portefeuilleRepo: Repository<Portefeuille>,
    @InjectRepository(EcritureComptable)
    private readonly ecritureRepo: Repository<EcritureComptable>,
    @InjectRepository(JetonRetraitConsomme)
    private readonly jetonConsommeRepo: Repository<JetonRetraitConsomme>,
    @Inject(FEDAPAY_CLIENT)
    private readonly fedapayClient: IFedapayClient,
    private readonly parametres: ParametreSystemeService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Calcule les frais sur un retrait.
   * TODO(decision) : frais déduits du montant envoyé (provisoire).
   * Le membre reçoit `montant - frais`.
   */
  calculerFraisRetrait(montant: number, pourcentage: number): number {
    return calculerFrais(montant, pourcentage);
  }

  /**
   * Vérifie le jeton de retrait JWT (audience `tontine-retrait`) et que le
   * subject correspond au membre demandeur. Retourne le jti pour consommation.
   *
   * Ne consomme PAS le jeton ici : la consommation se fait dans la transaction
   * DB de `creer()` pour que le jeton ne soit marqué consommé que si le retrait
   * est effectivement créé.
   */
  extraireEtVerifierJetonRetrait(
    jetonBrut: string,
    membreId: number,
  ): { jti: string; expireLe: Date } {
    let payload: JwtRetraitPayload & { jti?: string; exp?: number };
    try {
      payload = this.jwtService.verify<
        JwtRetraitPayload & { jti?: string; exp?: number }
      >(jetonBrut, { audience: 'tontine-retrait' });
    } catch {
      throw new UnauthorizedException('Jeton de retrait invalide ou expiré.');
    }
    if (payload.sub !== membreId) {
      throw new UnauthorizedException('Jeton de retrait invalide ou expiré.');
    }
    if (!payload.jti) {
      throw new UnauthorizedException(
        'Jeton de retrait invalide : identifiant manquant.',
      );
    }
    const expireLe = payload.exp
      ? new Date(payload.exp * 1000)
      : new Date(Date.now() + 5 * 60 * 1000);
    return { jti: payload.jti, expireLe };
  }

  /**
   * @deprecated Conservé pour compatibilité avec les tests existants.
   * Utiliser extraireEtVerifierJetonRetrait() + consommation dans la tx DB.
   */
  verifierEtConsommerJetonRetrait(jetonBrut: string, membreId: number): void {
    this.extraireEtVerifierJetonRetrait(jetonBrut, membreId);
  }

  /**
   * Initie un retrait de cotisation vers Mobile Money.
   *
   * Flux :
   * 1. Valider le DTO (montant XOR total).
   * 2. Vérifier et extraire le jti du jeton de retrait.
   * 3. Transaction DB avec verrou pessimiste sur Portefeuille :
   *    a. Consommer le jeton (INSERT jti — contrainte unique → 401 si rejoué).
   *    b. Calculer retirable (solde - fondsCaisse - bloqué - retraitsEnAttente).
   *    c. Garde-fous solde et retrait en cours.
   *    d. Créer la Transaction en base (statut en_attente).
   * 4. Appeler FedaPay Payout.
   * 5. Mettre à jour idFedapay.
   */
  async creer(
    membreId: number,
    dto: CreerRetraitDto,
  ): Promise<ResultatRetrait> {
    // ---- 1. Valider le DTO ----
    const aMontant = dto.montant !== undefined && dto.montant > 0;
    const aTotal = dto.total === true;
    if (!aMontant && !aTotal) {
      throw new BadRequestException(
        'Fournissez `montant` (entier positif) ou `total: true`.',
      );
    }
    if (aMontant && aTotal) {
      throw new BadRequestException(
        "`montant` et `total` sont exclusifs : choisissez l'un ou l'autre.",
      );
    }

    // ---- 2. Vérifier le jeton (hors transaction DB) ----
    const { jti, expireLe } = this.extraireEtVerifierJetonRetrait(
      dto.jetonRetrait,
      membreId,
    );

    // ---- 3. Transaction DB avec verrou pessimiste ----
    const etat: {
      savedTx: Transaction | null;
      montantDemande: number;
      fraisFedapay: number;
    } = { savedTx: null, montantDemande: 0, fraisFedapay: 0 };

    await this.txRepo.manager.transaction(async (manager) => {
      // a. Consommer le jeton DANS la transaction DB.
      //    La contrainte UNIQUE sur jti garantit qu'une seule demande passe.
      //    Si le jti est déjà présent → violation d'unicité → 401.
      try {
        const jetonConsomme = manager
          .getRepository(JetonRetraitConsomme)
          .create({ jti, expireLe });
        await manager.getRepository(JetonRetraitConsomme).save(jetonConsomme);
      } catch {
        throw new UnauthorizedException(
          'Ce jeton de retrait a déjà été utilisé.',
        );
      }

      // Verrou pessimiste sur le portefeuille du membre.
      const portefeuille = await manager
        .getRepository(Portefeuille)
        .createQueryBuilder('p')
        .setLock('pessimistic_write')
        .where('p.membre_id = :membreId', { membreId })
        .getOne();
      if (!portefeuille) {
        throw new UnprocessableEntityException('Portefeuille introuvable.');
      }

      // b. Calculer fondsCaisseRetenu.
      const fondsCaisseResult = await manager
        .getRepository(EcritureComptable)
        .createQueryBuilder('e')
        .select('COALESCE(SUM(e.montant), 0)', 'total')
        .where('e.membre_id = :membreId', { membreId })
        .andWhere('e.type = :type', { type: TypeEcriture.FONDS_CAISSE })
        .getRawOne<{ total: string }>();
      const fondsCaisseRetenu = Number(fondsCaisseResult?.total ?? 0);

      // Calculer retirable brut.
      const retirable = Math.max(
        0,
        portefeuille.soldeCotisation -
          fondsCaisseRetenu -
          portefeuille.soldeBloque,
      );

      // Soustraire les retraits en attente.
      // NB : `epargne_id IS NULL` isole les retraits de cotisation des
      // retraits d'épargne (qui partagent le type `retrait` mais ne touchent
      // pas au solde de cotisation). Sans ce filtre, un retrait d'épargne en
      // attente réduirait à tort le retirable de cotisation.
      const retraitReserveResult = await manager
        .getRepository(Transaction)
        .createQueryBuilder('tx')
        .select('COALESCE(SUM(tx.montant), 0)', 'total')
        .where('tx.membre_id = :membreId', { membreId })
        .andWhere('tx.type = :type', { type: TypeTransaction.RETRAIT })
        .andWhere('tx.statut = :statut', {
          statut: StatutTransaction.EN_ATTENTE,
        })
        .andWhere('tx.epargne_id IS NULL')
        .getRawOne<{ total: string }>();
      const retraitReserve = Number(retraitReserveResult?.total ?? 0);

      // d. Retirable réel.
      const retirableReel = Math.max(0, retirable - retraitReserve);

      // e. Vérifier qu'il y a quelque chose à retirer.
      if (retirableReel === 0) {
        throw new UnprocessableEntityException(
          'Votre solde disponible est nul.',
        );
      }

      // f. Montant demandé.
      etat.montantDemande = aTotal ? retirableReel : dto.montant!;

      // g. Vérifier que le montant ne dépasse pas le retirable.
      if (etat.montantDemande > retirableReel) {
        throw new UnprocessableEntityException(
          'Montant supérieur au solde disponible.',
        );
      }

      // C. Garde-fou soldeBloque pour retrait total.
      //    TODO(decision) [prompt 7] : que faire d'un retrait total quand des
      //    gages actifs existent ? Actuellement on refuse ; à reconsidérer
      //    quand le prompt 7 (prêts) sera implémenté.
      if (aTotal && portefeuille.soldeBloque > 0) {
        throw new UnprocessableEntityException(
          'Retrait total impossible : des fonds sont bloqués comme garantie de prêt.',
        );
      }

      // h. Vérifier qu'aucun retrait n'est déjà en cours.
      if (retraitReserve > 0) {
        throw new ConflictException('Un retrait est déjà en cours.');
      }

      // i. Calculer les frais.
      const pourcentageFraisRetrait = await this.parametres
        .getNumber('pourcentage_frais_retrait')
        .catch(() => 0);
      etat.fraisFedapay = this.calculerFraisRetrait(
        etat.montantDemande,
        pourcentageFraisRetrait,
      );

      // j. Créer la transaction.
      const dateStr = dateBeninISO().replace(/-/g, '');
      const referenceUnique = `TX-${membreId}-${dateStr}-${randomUUID().slice(0, 8)}`;
      const tx = manager.getRepository(Transaction).create({
        type: TypeTransaction.RETRAIT,
        montant: etat.montantDemande,
        fraisFedapay: etat.fraisFedapay,
        referenceUnique,
        idFedapay: null,
        statut: StatutTransaction.EN_ATTENTE,
        joursCibles: null,
        estRetraitTotal: aTotal,
        membre: { id: membreId },
      });

      // k. Sauvegarder.
      etat.savedTx = await manager.getRepository(Transaction).save(tx);
    });

    if (!etat.savedTx) {
      throw new UnprocessableEntityException(
        'Erreur interne lors de la création du retrait.',
      );
    }
    const savedTx: Transaction = etat.savedTx;

    // ---- 4. Appeler FedaPay Payout ----
    const membre = await this.membreRepo.findOneBy({ id: membreId });
    if (!membre) {
      throw new BadRequestException('Membre introuvable.');
    }
    const montantVerse = etat.montantDemande - etat.fraisFedapay;
    try {
      const resultat = await this.fedapayClient.creerEtEnvoyerPayout({
        montant: montantVerse,
        description: 'Retrait Le Refuge',
        referenceUnique: savedTx.referenceUnique,
        client: { nom: membre.nom, phone: membre.phone },
      });
      // ---- 5. Mettre à jour idFedapay ----
      savedTx.idFedapay = resultat.idFedapayPayout;
      const finalTx = await this.txRepo.save(savedTx);
      return { transaction: finalTx };
    } catch (err: unknown) {
      this.logger.error(
        `Erreur FedaPay creerEtEnvoyerPayout pour tx ${savedTx.id} : ${(err as Error).message}`,
      );
      savedTx.statut = StatutTransaction.ECHOUE;
      await this.txRepo.save(savedTx);
      throw new ServiceUnavailableException(
        'Service de paiement indisponible.',
      );
    }
  }
}
