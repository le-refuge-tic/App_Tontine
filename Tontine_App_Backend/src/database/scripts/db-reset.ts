/**
 * Script de remise à zéro de la base de données (développement uniquement).
 *
 * Usage :
 *   npm run db:reset             — avec confirmation interactive
 *   npm run db:reset -- --yes    — sans confirmation (CI / scripts)
 *   npm run db:reset -- --force  — autorise un hôte non-local
 *
 * Sécurités :
 *   - Refuse si NODE_ENV === 'production'.
 *   - Refuse si DB_HOST n'est ni 'localhost' ni '127.0.0.1' sans --force.
 *   - Affiche base + hôte ciblés et demande de taper "oui" avant d'effacer
 *     (sauf avec --yes).
 *   - N'active jamais dropSchema ni synchronize dans TypeORM.
 */

import 'dotenv/config';
import * as readline from 'readline';
import { execSync } from 'child_process';
import { AppDataSource } from '../data-source';

// ── Lecture des options de la ligne de commande ──────────────────────────────

const args = process.argv.slice(2);
const avecYes   = args.includes('--yes');
const avecForce = args.includes('--force');

// ── Variables d'environnement ─────────────────────────────────────────────────

const nodeEnv  = process.env.NODE_ENV  ?? 'development';
const dbHost   = process.env.DB_HOST   ?? 'localhost';
const dbName   = process.env.DB_NAME   ?? '(inconnue)';

// ── Garde-fous ────────────────────────────────────────────────────────────────

if (nodeEnv === 'production') {
  console.error(
    '\n❌  REFUSÉ : NODE_ENV vaut "production". ' +
    'Ce script ne s\'exécute jamais en production.\n',
  );
  process.exit(1);
}

const hostsLocaux = ['localhost', '127.0.0.1'];
if (!hostsLocaux.includes(dbHost) && !avecForce) {
  console.error(
    `\n❌  REFUSÉ : DB_HOST vaut "${dbHost}", qui n'est pas un hôte local ` +
    `(localhost / 127.0.0.1).\n` +
    `    Ajoutez l'option --force si vous savez ce que vous faites.\n`,
  );
  process.exit(1);
}

// ── Confirmation interactive ──────────────────────────────────────────────────

async function demanderConfirmation(): Promise<void> {
  if (avecYes) return; // mode script : confirmation ignorée

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve, reject) => {
    console.log('\n⚠️   ATTENTION : remise à zéro de la base de données');
    console.log(`    Serveur  : ${dbHost}`);
    console.log(`    Base     : ${dbName}`);
    console.log(`    Cette opération EFFACE TOUTES LES DONNÉES.\n`);

    rl.question('    Tapez "oui" pour confirmer : ', (réponse) => {
      rl.close();
      if (réponse.trim().toLowerCase() === 'oui') {
        resolve();
      } else {
        console.log('\n    Annulé.\n');
        reject(new Error('annulé'));
      }
    });
  });
}

// ── Corps principal ───────────────────────────────────────────────────────────

async function main(): Promise<void> {
  await demanderConfirmation();

  // 1. Connexion
  console.log('\n🔌  Connexion à la base…');
  await AppDataSource.initialize();

  try {
    // 2. Suppression complète du schéma public (tables + types + séquences + index)
    console.log('🗑️   Suppression du schéma public…');
    await AppDataSource.query('DROP SCHEMA public CASCADE');
    await AppDataSource.query('CREATE SCHEMA public');
    // Restaure les droits par défaut (nécessaire sur certaines versions de PG)
    await AppDataSource.query('GRANT ALL ON SCHEMA public TO public');
    console.log('    Schéma supprimé et recréé.');

    // 3. Migrations
    console.log('🔄  Exécution des migrations…');
    await AppDataSource.runMigrations({ transaction: 'each' });
    const migsExecutees = await AppDataSource.query<{ name: string }[]>(
      'SELECT name FROM migrations ORDER BY id',
    );
    for (const m of migsExecutees) {
      console.log(`    ✓ ${m.name}`);
    }

  } finally {
    // On ferme ici pour que le seed puisse ouvrir sa propre connexion
    await AppDataSource.destroy();
  }

  // 4. Seed (relancé via le script npm existant pour réutiliser exactement le même code)
  console.log('🌱  Exécution du seed…');
  execSync('npm run seed', { stdio: 'inherit', cwd: process.cwd() });

  console.log('\n✅  Base remise à zéro avec succès.\n');
}

main().catch((err: unknown) => {
  if (err instanceof Error && err.message === 'annulé') {
    process.exit(0);
  }
  console.error('\n❌  Erreur lors de la remise à zéro :', err, '\n');
  process.exit(1);
});
