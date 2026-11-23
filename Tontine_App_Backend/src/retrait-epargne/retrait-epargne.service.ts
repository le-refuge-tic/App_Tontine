import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { RetraitEpargne } from './entities/retrait-epargne.entity';
import { Epargne } from '../epargne/entities/epargne.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import { JetonRetraitConsomme } from '../jeton-retrait-consomme/entities/jeton-retrait-consomme.entity';
import type { IFedapayClient } from '../fedapay/fedapay-client.interface';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { calculerFrais } from '../depot/depot.service';
import {
  StatutEpargne,
  StatutTransaction,
  TypeTransaction,
} from '../common/enums';
import { dateBeninISO } from '../common/utils/dates.util';
import type { JwtRetraitPayload } from '../auth/interfaces/jwt-payload.interface';
import { CreateRetraitEpargneDto } from './dto/create-retrait-epargne.dto';

export interface ResultatRetraitEpargne {
  transaction: Transaction;
}

/**
 * Service des retraits d'épargne. Même sécurité que les retraits de cotisation :
 * jeton de retrait vérifié puis consommé dans la même transaction DB que la
 * création, verrou pessimiste sur l'épargne, un seul retrait d'épargne en
 * attente à la fois par membre.
 *
 * Le serveur décide du taux (5 % avant l'échéance, 2,75 % à ou après) d'après
 * la date du jour au fuseau Africa/Porto-Novo. Aucune écriture grand livre
 * avant le succès du webhook FedaPay.
 */
@Injectable()
export class RetraitEpargneService {
  private readonly logger = new Logger(RetraitEpargneService.name);

  constructor(
    @InjectRepository(RetraitEpargne)
    private readonly retraitRepo: Repository<RetraitEpargne>,
    @InjectRepository(Epargne)
    private readonly epargneRepo: Repository<Epargne>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Membre)
    private readonly membreRepo: Repository<Membre>,
    @InjectRepository(JetonRetraitConsomme)
    private readonly jetonConsommeRepo: Repository<JetonRetraitConsomme>,
    @Inject(FEDAPAY_CLIENT)
    private readonly fedapayClient: IFedapayClient,
    private readonly parametres: ParametreSystemeService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * Vérifie le jeton de retrait JWT (audience `tontine-retrait`) et que le
   * `subject` correspond au membre demandeur. Retourne le `jti` pour
   * consommation. Ne consomme PAS le jeton ici : la consommation se fait dans
   * la transaction DB de `creer()`.
   */
  private extraireEtVerifierJetonRetrait(
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
   * Initie un retrait d'épargne vers Mobile Money.
   *
   * Flux :
   * 1. Valider le DTO (montant XOR total).
   * 2. Vérifier et extraire le jti du jeton de retrait.
   * 3. Transaction DB avec verrou pessimiste sur l'épargne :
   *    a. Consommer le jeton (INSERT jti — contrainte unique → 401 si rejoué).
   *    b. Vérifier l'appartenance et le statut actif de l'épargne.
   *    c. Refuser si un retrait d'épargne est déjà en attente (409).
   *    d. Calculer le taux (5 % ou 2,75 %), la retenue, les frais, le net.
   *    e. Créer la Transaction (retrait) + le RetraitEpargne lié.
   * 4. Appeler FedaPay Payout (montant = net versé).
   * 5. Mettre à jour idFedapay.
   */
  async creer(
    membreId: number,
    epargneId: number,
    dto: CreateRetraitEpargneDto,
  ): Promise<ResultatRetraitEpargne> {
    // 1. Valider le DTO.
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

    // 2. Vérifier le jeton (hors transaction DB).
    const { jti, expireLe } = this.extraireEtVerifierJetonRetrait(
      dto.jetonRetrait,
      membreId,
    );

    // 3. Transaction DB avec verrou pessimiste.
    const etat: {
      savedTx: Transaction | null;
      montantNet: number;
    } = { savedTx: null, montantNet: 0 };

    await this.txRepo.manager.transaction(async (manager) => {
      // a. Consommer le jeton dans la transaction DB.
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

      // b. Verrou pessimiste sur l'épargne.
      const epargne = await manager
        .getRepository(Epargne)
        .createQueryBuilder('e')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('e.membre', 'membre')
        .where('e.id = :epargneId', { epargneId })
        .getOne();
      if (!epargne || epargne.membre.id !== membreId) {
        throw new NotFoundException(`Épargne introuvable : ${epargneId}.`);
      }
      if (epargne.statut !== StatutEpargne.ACTIVE) {
        throw new UnprocessableEntityException(
          "Cette épargne n'est plus active.",
        );
      }

      // c. Un seul retrait d'épargne en attente par membre.
      const pendingCount = await manager
        .getRepository(Transaction)
        .createQueryBuilder('tx')
        .where('tx.membre_id = :membreId', { membreId })
        .andWhere('tx.type = :type', { type: TypeTransaction.RETRAIT })
        .andWhere('tx.statut = :statut', {
          statut: StatutTransaction.EN_ATTENTE,
        })
        .andWhere('tx.epargne_id IS NOT NULL')
        .getCount();
      if (pendingCount > 0) {
        throw new ConflictException(
          'Un retrait d\'épargne est déjà en cours.',
        );
      }

      // d. Montant demandé et garde-fous.
      const montantDemande = aTotal ? epargne.montant : dto.montant!;
      if (montantDemande <= 0) {
        throw new UnprocessableEntityException(
          'Le solde de cette épargne est nul.',
        );
      }
      if (montantDemande > epargne.montant) {
        throw new UnprocessableEntityException(
          'Montant supérieur au solde de l\'épargne.',
        );
      }

      // Taux (5 % avant l'échéance, 2,75 % à ou après), fuseau Africa/Porto-Novo.
      const aujourdhui = dateBeninISO();
      const estAnticipe = aujourdhui < epargne.dateEcheance;
      const taux = estAnticipe
        ? await this.parametres
            .getNumber('penalite_epargne_anticipee')
            .catch(() => 5)
        : await this.parametres
            .getNumber('retenue_epargne_echeance')
            .catch(() => 2.75);
      const retenue = Math.ceil((montantDemande * taux) / 100);
      // TODO(decision) : mode d'arrondi de la retenue (provisoire : entier
      //   supérieur, l'application garde l'arrondi).
      const pourcentageFraisRetrait = await this.parametres
        .getNumber('pourcentage_frais_retrait')
        .catch(() => 0);
      const frais = calculerFrais(montantDemande, pourcentageFraisRetrait);

      const montantNet = montantDemande - retenue - frais;
      if (montantNet <= 0) {
        throw new UnprocessableEntityException(
          'Montant trop faible : la retenue et les frais dépassent le montant demandé.',
        );
      }
      etat.montantNet = montantNet;

      // e. Créer la Transaction (retrait) liée à l'épargne.
      const dateStr = dateBeninISO().replace(/-/g, '');
      const referenceUnique = `TX-${membreId}-${dateStr}-${randomUUID().slice(0, 8)}`;
      const tx = manager.getRepository(Transaction).create({
        type: TypeTransaction.RETRAIT,
        montant: montantNet,
        fraisFedapay: frais,
        referenceUnique,
        idFedapay: null,
        statut: StatutTransaction.EN_ATTENTE,
        joursCibles: null,
        estRetraitTotal: aTotal,
        epargne: { id: epargne.id },
        membre: { id: membreId },
      });
      const savedTx = await manager.getRepository(Transaction).save(tx);

      // f. Créer le RetraitEpargne lié (OneToOne propriétaire).
      const retrait = manager.getRepository(RetraitEpargne).create({
        montant: montantDemande,
        tauxApplique: taux,
        montantRetenu: retenue,
        estAnticipe,
        epargne: { id: epargne.id },
        transaction: { id: savedTx.id },
      });
      await manager.getRepository(RetraitEpargne).save(retrait);

      etat.savedTx = savedTx;
    });

    if (!etat.savedTx) {
      throw new UnprocessableEntityException(
        'Erreur interne lors de la création du retrait d\'épargne.',
      );
    }
    const savedTx: Transaction = etat.savedTx;

    // 4. Appeler FedaPay Payout (montant net versé au membre).
    const membre = await this.membreRepo.findOneBy({ id: membreId });
    if (!membre) {
      throw new BadRequestException('Membre introuvable.');
    }
    try {
      const resultat = await this.fedapayClient.creerEtEnvoyerPayout({
        montant: etat.montantNet,
        description: 'Retrait épargne Le Refuge',
        referenceUnique: savedTx.referenceUnique,
        client: { nom: membre.nom, phone: membre.phone },
      });
      // 5. Mettre à jour idFedapay.
      savedTx.idFedapay = resultat.idFedapayPayout;
      const finalTx = await this.txRepo.save(savedTx);
      return { transaction: finalTx };
    } catch (err: unknown) {
      this.logger.error(
        `Erreur FedaPay creerEtEnvoyerPayout (épargne) pour tx ${savedTx.id} : ${(err as Error).message}`,
      );
      savedTx.statut = StatutTransaction.ECHOUE;
      await this.txRepo.save(savedTx);
      throw new ServiceUnavailableException(
        'Service de paiement indisponible.',
      );
    }
  }
}
