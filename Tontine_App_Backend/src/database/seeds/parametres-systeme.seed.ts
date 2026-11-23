import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { buildDataSourceOptions } from '../../config/typeorm.config';
import { ParametreSysteme } from '../../parametre-systeme/entities/parametre-systeme.entity';
import { Membre } from '../../membre/entities/membre.entity';
import { Portefeuille } from '../../portefeuille/entities/portefeuille.entity';
import { Role, StatutMembre } from '../../common/enums';

/**
 * Paramètres système (métier + sécurité). Idempotent : upsert sur la clé primaire.
 */
const parametres: Array<{ cle: string; valeur: string; description: string }> = [
  // ---- Métier ----
  {
    cle: 'mise_minimale',
    valeur: '200',
    description: "Mise de base minimale d'une souscription (FCFA)",
  },
  {
    cle: 'jours_par_mois',
    valeur: '31',
    description: 'Nombre de jours de paiement par cycle',
  },
  {
    cle: 'penalite_epargne_anticipee',
    valeur: '5',
    description: "Pénalité (%) sur un retrait d'épargne avant échéance",
  },
  {
    cle: 'retenue_epargne_echeance',
    valeur: '2.75',
    description: "Retenue (%) sur un retrait d'épargne à ou après échéance",
  },
  {
    cle: 'epargne_minimale',
    valeur: '1',
    description: "Montant minimal d'un dépôt d'épargne (FCFA)",
  },
  {
    cle: 'mois_regularite_pret',
    valeur: '6',
    description: "Nombre de mois de régularité d'un prêt",
  },
  {
    cle: 'multiplicateur_pret',
    valeur: '4',
    description: 'Multiplicateur du plafond de prêt (retirable du mois x multiplicateur)',
  },
  // ---- Sécurité anti-bruteforce ----
  {
    cle: 'max_tentatives_connexion',
    valeur: '5',
    description: 'Nombre maximal de tentatives de connexion avant blocage',
  },
  {
    cle: 'duree_blocage_connexion_minutes',
    valeur: '15',
    description: 'Durée du blocage de connexion (minutes) après trop de tentatives',
  },
  {
    cle: 'max_tentatives_code_retrait',
    valeur: '3',
    description: 'Nombre maximal de tentatives de code de retrait avant blocage',
  },
  {
    cle: 'duree_blocage_code_retrait_minutes',
    valeur: '30',
    description: 'Durée du blocage du code de retrait (minutes) après trop de tentatives',
  },
  // ---- FedaPay ----
  {
    cle: 'pourcentage_frais_fedapay',
    valeur: '0',
    description:
      'Pourcentage des frais FedaPay ajoutés au montant du dépôt (0 = aucun frais)',
  },
];

async function run(): Promise<void> {
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
    // ---- 1. Paramètres système ----
    const paramRepo = dataSource.getRepository(ParametreSysteme);
    await paramRepo.upsert(parametres, ['cle']);
    console.log(`Seed : ${parametres.length} paramètres système insérés/mis à jour.`);

    // ---- 2. Premier administrateur ----
    const adminPhone = process.env.ADMIN_PHONE;
    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPhone || !adminPassword) {
      console.log(
        'Seed : ADMIN_PHONE ou ADMIN_PASSWORD absent — création du compte admin ignorée.',
      );
    } else {
      const membreRepo = dataSource.getRepository(Membre);
      const portefeuilleRepo = dataSource.getRepository(Portefeuille);

      // Normalisation du numéro (suppression espaces, +, tirets)
      const phoneMormalise = adminPhone.replace(/[\s+\-]/g, '');

      const adminExistant = await membreRepo.findOneBy({ phone: phoneMormalise });
      if (adminExistant) {
        console.log(
          `Seed : compte admin déjà existant (phone : ${phoneMormalise}) — ignoré.`,
        );
      } else {
        const rounds = Number(process.env.BCRYPT_ROUNDS ?? 12);
        const hashedPassword = await bcrypt.hash(adminPassword, rounds);

        await dataSource.transaction(async (manager) => {
          const mRepo = manager.getRepository(Membre);
          const pRepo = manager.getRepository(Portefeuille);

          const admin = mRepo.create({
            nom: 'Administrateur',
            phone: phoneMormalise,
            password: hashedPassword,
            role: Role.ADMIN,
            statut: StatutMembre.ACTIF,
          });
          const savedAdmin = await mRepo.save(admin);

          const portefeuille = pRepo.create({
            soldeCotisation: 0,
            soldeEpargne: 0,
            soldeBloque: 0,
            membre: savedAdmin,
          });
          await pRepo.save(portefeuille);
        });

        console.log(`Seed : compte admin créé (phone : ${phoneMormalise}).`);
      }
    }
  } finally {
    await dataSource.destroy();
  }
}

run().catch((err: unknown) => {
  console.error('Erreur lors du seed :', err);
  process.exit(1);
});
