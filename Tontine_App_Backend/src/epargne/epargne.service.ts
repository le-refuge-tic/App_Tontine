import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { randomUUID } from 'crypto';
import { ConfigService } from '@nestjs/config';
import { Epargne } from './entities/epargne.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { Membre } from '../membre/entities/membre.entity';
import type { IFedapayClient } from '../fedapay/fedapay-client.interface';
import { FEDAPAY_CLIENT } from '../fedapay/fedapay-client.interface';
import { ParametreSystemeService } from '../parametre-systeme/parametre-systeme.service';
import { FedapayConfig } from '../config/configuration';
import { calculerFrais } from '../depot/depot.service';
import {
  StatutEpargne,
  StatutTransaction,
  TypeTransaction,
} from '../common/enums';
import { dateBeninISO } from '../common/utils/dates.util';
import { CreateEpargneDto } from './dto/create-epargne.dto';
import { AjouterDepotEpargneDto } from './dto/ajouter-depot-epargne.dto';
import { UpdateEpargneDto } from './dto/update-epargne.dto';

/**
 * Calcule la progression vers l'objectif, en entier de 0 à 100 (arrondi à
 * l'inférieur, plafonné à 100).
 *
 * Exemple : montant=750, objectif=1000 → 75.
 *           montant=1200, objectif=1000 → 100 (plafond).
 */
export function calculerProgressionPourcent(
  montant: number,
  objectif: number,
): number {
  if (objectif <= 0) return 0;
  return Math.min(100, Math.floor((montant * 100) / objectif));
}

/**
 * Détermine si l'objectif est atteint au sens du règlement de retrait.
 *
 * L'objectif est considéré atteint si :
 * - `objectifAtteintLe` est non null (atteint lors d'un dépôt passé), OU
 * - `montant >= objectifMontant` au moment de l'appel.
 *
 * Cette vérification double garantit que l'objectif reste acquis même si le
 * solde est retombé sous l'objectif après un retrait partiel.
 *
 * TODO(decision) : retrait partiel qui ramène le solde sous l'objectif →
 *   l'objectif reste acquis (choix actuel). Faut-il le réviser ?
 */
export function objectifEstAtteint(
  montant: number,
  objectifMontant: number,
  objectifAtteintLe: Date | null,
): boolean {
  return objectifAtteintLe != null || montant >= objectifMontant;
}

/** Aperçu indicatif du retrait total de l'épargne si l'on retirait maintenant. */
export interface ApercuEpargne {
  /** Montant retenu (pénalité ou retenue) sur un retrait total immédiat. */
  penaliteSiRetraitMaintenant: number;
  /** Taux applicable : 5 % si objectif non atteint, 2,75 % si atteint. */
  tauxApplicable: number;
  /** Montant net estimé versé au membre (après retenue et frais). */
  netEstime: number;
  /** Vrai si l'objectif est atteint (objectifAtteintLe non null ou montant ≥ objectif). */
  objectifAtteint: boolean;
  /** Montant restant à épargner pour atteindre l'objectif (max 0). */
  resteAAtteindre: number;
}

/** Vue d'une épargne renvoyée à l'API (sans la relation `membre`). */
export interface EpargneVue {
  id: number;
  montant: number;
  /** Toujours null depuis le prompt 7b (plus de date de fin). */
  dateEcheance: string | null;
  statut: StatutEpargne;
  /** Nom du projet d'épargne (2 à 100 caractères). */
  nom: string;
  /** Montant cible (FCFA, > 0). Obligatoire depuis le prompt 7b. */
  objectifMontant: number;
  /**
   * Date à laquelle l'objectif a été atteint pour la première fois.
   * Null tant que l'objectif n'est pas atteint. Ne se vide jamais.
   */
  objectifAtteintLe: Date | null;
  /**
   * Progression en pourcentage (entier entre 0 et 100, arrondi à l'inférieur,
   * plafonné à 100).
   *
   * TODO(decision) : comment afficher la progression lorsque le montant dépasse
   *   l'objectif ? Actuellement plafonné à 100.
   */
  progressionPourcent: number;
  apercu: ApercuEpargne;
}

export interface ResultatCreationEpargne {
  epargne: EpargneVue;
  transaction: Transaction;
  /** Null si une transaction en attente identique a été réutilisée. */
  urlPaiement: string | null;
}

export interface ResultatDepotEpargne {
  transaction: Transaction;
  urlPaiement: string | null;
}

/** Taux métier lus dans ParametreSysteme (avec valeurs par défaut). */
interface TauxEpargne {
  penalite: number;
  retenue: number;
  fraisRetraitPct: number;
}

@Injectable()
export class EpargneService {
  private readonly logger = new Logger(EpargneService.name);

  constructor(
    @InjectRepository(Epargne)
    private readonly epargneRepo: Repository<Epargne>,
    @InjectRepository(Transaction)
    private readonly txRepo: Repository<Transaction>,
    @InjectRepository(Membre)
    private readonly membreRepo: Repository<Membre>,
    @Inject(FEDAPAY_CLIENT)
    private readonly fedapayClient: IFedapayClient,
    private readonly parametres: ParametreSystemeService,
    private readonly config: ConfigService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────────
  //  Lecture
  // ─────────────────────────────────────────────────────────────────────────

  async findAll(membreId: number): Promise<EpargneVue[]> {
    const epargnes = await this.epargneRepo.find({
      where: { membre: { id: membreId } },
      order: { id: 'DESC' },
    });
    const taux = await this.lireTaux();
    return epargnes.map((e) => this.versVue(e, taux));
  }

  async findOne(id: number, membreId: number): Promise<EpargneVue> {
    const epargne = await this.epargneRepo.findOne({
      where: { id },
      relations: { membre: true },
    });
    if (!epargne || epargne.membre.id !== membreId) {
      throw new NotFoundException(`Épargne introuvable : ${id}.`);
    }
    const taux = await this.lireTaux();
    return this.versVue(epargne, taux);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Création + dépôt initial
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crée une épargne (statut actif, montant 0) et initie le dépôt initial
   * FedaPay en un seul geste. Renvoie `{ epargne, transaction, urlPaiement }`.
   *
   * - `dateEcheance` du DTO est ignorée silencieusement (plus de date de fin).
   * - `objectifMontant` est obligatoire (validé par le DTO : entier ≥ 1).
   */
  async creer(
    membreId: number,
    dto: CreateEpargneDto,
  ): Promise<ResultatCreationEpargne> {
    // 1. Validations.
    const minimale = await this.lireMinimale();
    if (dto.montantInitial < minimale) {
      throw new BadRequestException(
        `Le montant initial doit être d'au moins ${minimale} FCFA.`,
      );
    }
    // dateEcheance ignorée silencieusement (plus de règle « date dans le futur »).

    // 2. Frais (ajoutés au montant, comme la cotisation).
    const pourcentageFrais = await this.lireFraisDepot();
    const frais = calculerFrais(dto.montantInitial, pourcentageFrais);
    const montantTotal = dto.montantInitial + frais;

    // 3. Anti double-clic : une transaction en_attente identique
    //    (même montant total + même objectif) dans les 10 dernières minutes
    //    est réutilisée.
    const existante = await this.chercherDoublonCreation(
      membreId,
      montantTotal,
      dto.objectifMontant,
    );
    if (existante) {
      const taux = await this.lireTaux();
      return {
        epargne: this.versVue(existante.epargne, taux),
        transaction: existante.tx,
        urlPaiement: null,
      };
    }

    // 4. Créer l'épargne (montant 0, active, sans date d'échéance).
    const epargne = this.epargneRepo.create({
      montant: 0,
      dateEcheance: null,
      statut: StatutEpargne.ACTIVE,
      nom: dto.nom,
      objectifMontant: dto.objectifMontant,
      objectifAtteintLe: null,
      membre: { id: membreId },
    });
    const savedEpargne = await this.epargneRepo.save(epargne);

    // 5. Créer la transaction de dépôt initial.
    const { transaction, urlPaiement } = await this.creerDepotFedaPay(
      membreId,
      montantTotal,
      frais,
      savedEpargne.id,
      'Dépôt épargne Le Refuge',
    );

    const taux = await this.lireTaux();
    return {
      epargne: this.versVue({ ...savedEpargne, montant: 0 }, taux),
      transaction,
      urlPaiement,
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Modification du nom et de l'objectif (PATCH /epargnes/:id)
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Modifie le nom et/ou l'objectif d'une épargne ACTIVE appartenant au
   * membre.
   *
   * - 404 si l'épargne est introuvable ou n'appartient pas au membre.
   * - 409 si l'épargne n'est pas active.
   * - 409 si l'on tente de modifier l'objectif alors qu'un dépôt a déjà réussi
   *   (montant > 0 ou objectifAtteintLe non null) : message clair.
   *
   * Le nom reste toujours modifiable tant que l'épargne est active.
   *
   * TODO(decision) : autoriser une hausse de l'objectif après dépôt ?
   */
  async modifier(
    membreId: number,
    epargneId: number,
    dto: UpdateEpargneDto,
  ): Promise<EpargneVue> {
    const epargne = await this.epargneRepo.findOne({
      where: { id: epargneId },
      relations: { membre: true },
    });
    if (!epargne || epargne.membre.id !== membreId) {
      throw new NotFoundException(`Épargne introuvable : ${epargneId}.`);
    }
    if (epargne.statut !== StatutEpargne.ACTIVE) {
      throw new ConflictException(
        "Cette épargne n'est plus active : impossible de la modifier.",
      );
    }

    // L'objectif n'est modifiable que si aucun dépôt n'a encore réussi.
    // Condition : montant = 0 ET objectifAtteintLe null.
    if (dto.objectifMontant !== undefined) {
      const depotDejaReussi =
        epargne.montant > 0 || epargne.objectifAtteintLe != null;
      if (depotDejaReussi) {
        throw new ConflictException(
          "L'objectif ne peut plus être modifié : un dépôt a déjà été confirmé sur ce projet.",
        );
      }
      epargne.objectifMontant = dto.objectifMontant;
    }

    if (dto.nom !== undefined) {
      epargne.nom = dto.nom;
    }

    const saved = await this.epargneRepo.save(epargne);
    const taux = await this.lireTaux();
    return this.versVue(saved, taux);
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Dépôt additionnel
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Ajoute de l'argent à une épargne active via un dépôt FedaPay.
   */
  async ajouterDepot(
    membreId: number,
    epargneId: number,
    dto: AjouterDepotEpargneDto,
  ): Promise<ResultatDepotEpargne> {
    const epargne = await this.epargneRepo.findOne({
      where: { id: epargneId },
      relations: { membre: true },
    });
    if (!epargne || epargne.membre.id !== membreId) {
      throw new NotFoundException(`Épargne introuvable : ${epargneId}.`);
    }
    if (epargne.statut !== StatutEpargne.ACTIVE) {
      throw new UnprocessableEntityException(
        "Cette épargne n'est plus active.",
      );
    }

    const minimale = await this.lireMinimale();
    if (dto.montant < minimale) {
      throw new BadRequestException(
        `Le montant doit être d'au moins ${minimale} FCFA.`,
      );
    }

    const pourcentageFrais = await this.lireFraisDepot();
    const frais = calculerFrais(dto.montant, pourcentageFrais);
    const montantTotal = dto.montant + frais;

    // Anti double-clic : même épargne + même montant total en attente < 10 min.
    const existante = await this.chercherDoublonDepot(
      membreId,
      epargneId,
      montantTotal,
    );
    if (existante) {
      return { transaction: existante, urlPaiement: null };
    }

    return this.creerDepotFedaPay(
      membreId,
      montantTotal,
      frais,
      epargneId,
      'Dépôt épargne Le Refuge',
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  //  Helpers privés
  // ─────────────────────────────────────────────────────────────────────────

  /**
   * Crée la Transaction de dépôt FedaPay liée à une épargne, appelle FedaPay
   * et génère le lien de paiement.
   */
  private async creerDepotFedaPay(
    membreId: number,
    montantTotal: number,
    fraisFedapay: number,
    epargneId: number,
    description: string,
  ): Promise<ResultatDepotEpargne> {
    const membre = await this.membreRepo.findOneBy({ id: membreId });
    if (!membre) {
      throw new BadRequestException('Membre introuvable.');
    }

    const dateStr = dateBeninISO().replace(/-/g, '');
    const referenceUnique = `TX-${membreId}-${dateStr}-${randomUUID().slice(0, 8)}`;

    const transaction = this.txRepo.create({
      type: TypeTransaction.DEPOT,
      montant: montantTotal,
      fraisFedapay,
      referenceUnique,
      idFedapay: null,
      statut: StatutTransaction.EN_ATTENTE,
      joursCibles: null,
      epargne: { id: epargneId },
      membre: { id: membreId },
    });
    const savedTx = await this.txRepo.save(transaction);

    const appPublicUrl =
      this.config.get<FedapayConfig>('fedapay')?.appPublicUrl ?? '';
    const callbackUrl = `${appPublicUrl}/api/v1/webhooks/fedapay`;

    let idFedapay: string;
    try {
      const resultat = await this.fedapayClient.creerTransaction({
        description,
        montant: montantTotal,
        callbackUrl,
        client: { nom: membre.nom, phone: membre.phone },
      });
      idFedapay = resultat.idFedapay;
    } catch (err: unknown) {
      this.logger.error(
        `Erreur FedaPay creerTransaction (épargne) pour tx ${savedTx.id} : ${(err as Error).message}`,
      );
      savedTx.statut = StatutTransaction.ECHOUE;
      await this.txRepo.save(savedTx);
      throw new ServiceUnavailableException(
        'Service de paiement indisponible.',
      );
    }

    savedTx.idFedapay = idFedapay;
    await this.txRepo.save(savedTx);

    this.logger.log(
      `Dépôt épargne créé : transaction interne id=${savedTx.id}, idFedaPay=${idFedapay}, montant=${montantTotal} F`,
    );

    let urlPaiement: string;
    try {
      const lien = await this.fedapayClient.genererLienPaiement(idFedapay);
      urlPaiement = lien.urlPaiement;
    } catch (err: unknown) {
      this.logger.error(
        `Erreur FedaPay genererLienPaiement (épargne) pour tx ${savedTx.id} : ${(err as Error).message}`,
      );
      savedTx.statut = StatutTransaction.ECHOUE;
      await this.txRepo.save(savedTx);
      throw new ServiceUnavailableException(
        'Service de paiement indisponible.',
      );
    }

    return { transaction: savedTx, urlPaiement };
  }

  /** Recherche un dépôt d'épargne en attente identique (création). */
  private async chercherDoublonCreation(
    membreId: number,
    montantTotal: number,
    objectifMontant: number,
  ): Promise<{ tx: Transaction; epargne: Epargne } | null> {
    const dixMinutesAvant = new Date(Date.now() - 10 * 60 * 1000);
    const candidates = await this.txRepo.find({
      where: {
        membre: { id: membreId },
        type: TypeTransaction.DEPOT,
        statut: StatutTransaction.EN_ATTENTE,
      },
      relations: { epargne: true },
    });
    for (const tx of candidates) {
      if (
        tx.dateOperation >= dixMinutesAvant &&
        tx.montant === montantTotal &&
        tx.epargne != null &&
        tx.epargne.objectifMontant === objectifMontant
      ) {
        return { tx, epargne: tx.epargne };
      }
    }
    return null;
  }

  /** Recherche un dépôt en attente identique (dépôt additionnel). */
  private async chercherDoublonDepot(
    membreId: number,
    epargneId: number,
    montantTotal: number,
  ): Promise<Transaction | null> {
    const dixMinutesAvant = new Date(Date.now() - 10 * 60 * 1000);
    const candidates = await this.txRepo.find({
      where: {
        membre: { id: membreId },
        type: TypeTransaction.DEPOT,
        statut: StatutTransaction.EN_ATTENTE,
        epargne: { id: epargneId },
      },
    });
    for (const tx of candidates) {
      if (tx.dateOperation >= dixMinutesAvant && tx.montant === montantTotal) {
        return tx;
      }
    }
    return null;
  }

  private async lireMinimale(): Promise<number> {
    return this.parametres.getNumber('epargne_minimale').catch(() => 1);
  }

  private async lireFraisDepot(): Promise<number> {
    return this.parametres
      .getNumber('pourcentage_frais_fedapay')
      .catch(() => 0);
  }

  private async lireTaux(): Promise<TauxEpargne> {
    const penalite = await this.parametres
      .getNumber('penalite_epargne_anticipee')
      .catch(() => 5);
    const retenue = await this.parametres
      .getNumber('retenue_epargne_echeance')
      .catch(() => 2.75);
    const fraisRetraitPct = await this.parametres
      .getNumber('pourcentage_frais_retrait')
      .catch(() => 0);
    return { penalite, retenue, fraisRetraitPct };
  }

  private calculerApercu(epargne: Epargne, taux: TauxEpargne): ApercuEpargne {
    const atteint = objectifEstAtteint(
      epargne.montant,
      epargne.objectifMontant,
      epargne.objectifAtteintLe ?? null,
    );
    const tauxApplicable = atteint ? taux.retenue : taux.penalite;
    const retenu = Math.ceil((epargne.montant * tauxApplicable) / 100);
    const frais = calculerFrais(epargne.montant, taux.fraisRetraitPct);
    const net = Math.max(0, epargne.montant - retenu - frais);
    const resteAAtteindre = Math.max(
      0,
      epargne.objectifMontant - epargne.montant,
    );
    return {
      penaliteSiRetraitMaintenant: retenu,
      tauxApplicable,
      netEstime: net,
      objectifAtteint: atteint,
      resteAAtteindre,
    };
  }

  private versVue(epargne: Epargne, taux: TauxEpargne): EpargneVue {
    return {
      id: epargne.id,
      montant: epargne.montant,
      dateEcheance: epargne.dateEcheance ?? null,
      statut: epargne.statut,
      nom: epargne.nom ?? 'Mon projet',
      objectifMontant: epargne.objectifMontant,
      objectifAtteintLe: epargne.objectifAtteintLe ?? null,
      progressionPourcent: calculerProgressionPourcent(
        epargne.montant,
        epargne.objectifMontant,
      ),
      apercu: this.calculerApercu(epargne, taux),
    };
  }
}
