import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../config/typeorm.config';
import { Membre } from '../../membre/entities/membre.entity';
import { Portefeuille } from '../../portefeuille/entities/portefeuille.entity';
import { Souscription } from '../../souscription/entities/souscription.entity';
import { Cycle } from '../../cycle/entities/cycle.entity';
import { JourCotisation } from '../../jour-cotisation/entities/jour-cotisation.entity';
import {
  Regularite,
  Role,
  StatutJourCotisation,
  StatutMembre,
  StatutSouscription,
} from '../../common/enums';
import { construireCycle } from '../../common/utils/cycle.util';
import {
  aujourdhuiBenin,
  formatISO,
  nombreJoursMois,
  premierJourMoisISO,
} from '../../common/utils/dates.util';

/**
 * Seed de démonstration (développement uniquement). Crée un membre de démo
 * avec une souscription active (mise 500 F / jour), un cycle sur le mois
 * courant, des jours payés et perdus — pour tester l'écran mobile sans FedaPay.
 *
 * Idempotent : ignore ce qui existe déjà. Refuse de s'exécuter en production.
 *
 *   npm run seed:demo
 */
const DEMO_PHONE = '2290197000000';
const DEMO_PASSWORD = 'Demo1234';
const DEMO_MISE = 500;

async function run(): Promise<void> {
  if (process.env.NODE_ENV === 'production') {
    console.error('Seed démo refusé en production.');
    process.exit(1);
  }

  const dataSource = new DataSource(
    buildDataSourceOptions({
      host: process.env.DB_HOST ?? '',
      port: Number(process.env.DB_PORT ?? 5432),
      user: process.env.DB_USER ?? '',
      password: process.env.DB_PASSWORD ?? '',
      database: process.env.DB_NAME ?? '',
    }),
  );
  await dataSource.initialize();

  try {
    const membreRepo = dataSource.getRepository(Membre);
    const portefeuilleRepo = dataSource.getRepository(Portefeuille);
    const souscriptionRepo = dataSource.getRepository(Souscription);
    const cycleRepo = dataSource.getRepository(Cycle);
    const jourRepo = dataSource.getRepository(JourCotisation);

    // ---- 1. Membre de démo ----
    const membreExistant = await membreRepo.findOneBy({ phone: DEMO_PHONE });
    let membre = membreExistant;
    if (membre) {
      console.log(
        `Seed démo : membre déjà existant (phone ${DEMO_PHONE}) — conservé.`,
      );
    } else {
      const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
      const hash = await bcrypt.hash(DEMO_PASSWORD, rounds);
      membre = membreRepo.create({
        nom: 'Koffi Démo',
        phone: DEMO_PHONE,
        password: hash,
        role: Role.MEMBRE,
        statut: StatutMembre.ACTIF,
      });
      membre = await membreRepo.save(membre);
      console.log(
        `Seed démo : membre créé (phone ${DEMO_PHONE}, mot de passe « ${DEMO_PASSWORD} »).`,
      );
    }

    // ---- 2. Portefeuille ----
    let portefeuille = await portefeuilleRepo.findOne({
      where: { membre: { id: membre.id } },
    });
    if (!portefeuille) {
      portefeuille = portefeuilleRepo.create({
        soldeCotisation: 0,
        soldeEpargne: 0,
        soldeBloque: 0,
        membre,
      });
      await portefeuilleRepo.save(portefeuille);
    }

    // ---- 3. Souscription active ----
    let souscription = await souscriptionRepo.findOne({
      where: { membre: { id: membre.id }, statut: StatutSouscription.ACTIVE },
    });
    const aujourdhui = aujourdhuiBenin();
    if (!souscription) {
      souscription = souscriptionRepo.create({
        miseBase: DEMO_MISE,
        regularite: Regularite.JOUR,
        dateDemarrage: formatISO(
          aujourdhui.annee,
          aujourdhui.mois,
          aujourdhui.jour,
        ),
        statut: StatutSouscription.ACTIVE,
        prochaineMiseBase: null,
        prochaineRegularite: null,
        membre,
      });
      souscription = await souscriptionRepo.save(souscription);
    }

    // ---- 4. Cycle 1 sur le mois courant ----
    let cycle = await cycleRepo.findOne({
      where: { souscription: { id: souscription.id }, numero: 1 },
    });
    if (!cycle) {
      const dateDebut = premierJourMoisISO(aujourdhui.annee, aujourdhui.mois);
      const dateFin = formatISO(
        aujourdhui.annee,
        aujourdhui.mois,
        nombreJoursMois(aujourdhui.annee, aujourdhui.mois),
      );
      cycle = construireCycle({
        souscription,
        numero: 1,
        dateDebut,
        dateFin,
        miseBase: souscription.miseBase,
        regularite: souscription.regularite,
      });
      cycle = await cycleRepo.save(cycle); // cascade insert des jours
    }

    // ---- 5. Quelques jours payés / perdus (cas Koffi) ----
    const jours = await jourRepo.find({
      where: { cycle: { id: cycle.id } },
      order: { numeroJour: 'ASC' },
    });
    for (const jour of jours) {
      let modifie = false;
      if (jour.numeroJour <= 2 && jour.statut !== StatutJourCotisation.PAYE) {
        jour.montantPaye = jour.montantDu;
        jour.statut = StatutJourCotisation.PAYE;
        modifie = true;
      } else if (
        jour.numeroJour >= 3 &&
        jour.numeroJour <= 10 &&
        jour.statut === StatutJourCotisation.A_PAYER
      ) {
        jour.statut = StatutJourCotisation.PERDU;
        modifie = true;
      }
      if (modifie) await jourRepo.save(jour);
    }

    const payes = jours.filter(
      (j) => j.statut === StatutJourCotisation.PAYE,
    ).length;
    const perdus = jours.filter(
      (j) => j.statut === StatutJourCotisation.PERDU,
    ).length;
    console.log(
      `Seed démo : cycle ${cycle.numero} (${cycle.dateDebut} → ${cycle.dateFin}), ` +
        `${jours.length} jours, ${payes} payé(s), ${perdus} perdu(s).`,
    );
    console.log('Seed démo terminé.');
  } finally {
    await dataSource.destroy();
  }
}

void run().catch((err: unknown) => {
  console.error('Erreur lors du seed démo :', err);
  process.exit(1);
});
