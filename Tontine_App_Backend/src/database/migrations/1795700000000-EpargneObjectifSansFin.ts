import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : épargne basée sur l'objectif, sans date de fin (prompt 7b).
 *
 * 1. `date_echeance` sur `epargnes` → nullable (aucune suppression).
 * 2. `objectif_montant` → NOT NULL (entier ≥ 1) :
 *      - D'abord UPDATE des lignes existantes à NULL avec GREATEST(montant, 1).
 *      - Puis contrainte NOT NULL.
 *      - Le CHECK > 0 existant est conservé / recréé.
 *      TODO(verifier) : les lignes de test éventuellement affectées par le
 *        GREATEST(montant, 1) sur un montant 0 reçoivent objectif_montant = 1.
 * 3. `objectif_atteint_le` (timestamp with time zone, nullable) : date à
 *    laquelle l'objectif a été atteint pour la première fois.
 *    Cette valeur ne se vide jamais, même après un retrait.
 * 4. Paramètres système : vérification / insertion idempotente de
 *    `penalite_epargne_anticipee` (5) et `retenue_epargne_echeance` (2.75).
 *    Ces clés doivent exister pour que le service de retrait fonctionne sans
 *    base de données configurée (environnements de test).
 */
export class EpargneObjectifSansFin1795700000000 implements MigrationInterface {
  name = 'EpargneObjectifSansFin1795700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. date_echeance → nullable.
    //    La colonne existe avec NOT NULL depuis la migration Init.
    await queryRunner.query(
      `ALTER TABLE "epargnes" ALTER COLUMN "date_echeance" DROP NOT NULL`,
    );

    // 2a. Supprimer l'ancienne contrainte CHECK sur objectif_montant (si elle
    //     portait IS NULL OR > 0, incompatible avec NOT NULL).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CHK_epargnes_objectif_montant_positif'
        ) THEN
          ALTER TABLE "epargnes"
            DROP CONSTRAINT "CHK_epargnes_objectif_montant_positif";
        END IF;
      END $$;
    `);

    // 2b. Remplir les lignes existantes à NULL (objectif_montant IS NULL).
    //     TODO(verifier) : les lignes de test où montant = 0 reçoivent
    //       objectif_montant = 1 (GREATEST(0, 1) = 1).
    await queryRunner.query(`
      UPDATE "epargnes"
      SET "objectif_montant" = GREATEST("montant", 1)
      WHERE "objectif_montant" IS NULL
    `);

    // 2c. Passer NOT NULL.
    await queryRunner.query(
      `ALTER TABLE "epargnes" ALTER COLUMN "objectif_montant" SET NOT NULL`,
    );

    // 2d. Recréer la contrainte CHECK > 0 (sans IS NULL).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CHK_epargnes_objectif_montant_positif'
        ) THEN
          ALTER TABLE "epargnes"
            ADD CONSTRAINT "CHK_epargnes_objectif_montant_positif"
            CHECK ("objectif_montant" > 0);
        END IF;
      END $$;
    `);

    // 3. Colonne objectif_atteint_le (timestamp with time zone, nullable).
    await queryRunner.query(
      `ALTER TABLE "epargnes" ADD COLUMN IF NOT EXISTS "objectif_atteint_le" timestamptz NULL`,
    );

    // 4. Paramètres système (idempotents).
    await queryRunner.query(`
      INSERT INTO "parametres_systeme" ("cle", "valeur", "description")
      VALUES
        ('penalite_epargne_anticipee',  '5',    'Pénalité de retrait si objectif non atteint (%)'),
        ('retenue_epargne_echeance',    '2.75', 'Retenue de retrait si objectif atteint (%)')
      ON CONFLICT ("cle") DO NOTHING
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer les paramètres ajoutés (s'ils n'existaient pas avant).
    // Note : on ne les supprime pas pour ne pas casser un déploiement existant.

    // 3. Supprimer objectif_atteint_le.
    await queryRunner.query(
      `ALTER TABLE "epargnes" DROP COLUMN IF EXISTS "objectif_atteint_le"`,
    );

    // 2d. Supprimer la contrainte CHECK recréée.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CHK_epargnes_objectif_montant_positif'
        ) THEN
          ALTER TABLE "epargnes"
            DROP CONSTRAINT "CHK_epargnes_objectif_montant_positif";
        END IF;
      END $$;
    `);

    // 2c/2b. Remettre nullable (on ne peut pas annuler l'UPDATE de données).
    await queryRunner.query(
      `ALTER TABLE "epargnes" ALTER COLUMN "objectif_montant" DROP NOT NULL`,
    );

    // 2a. Recréer l'ancienne contrainte CHECK avec IS NULL OR > 0.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint
          WHERE conname = 'CHK_epargnes_objectif_montant_positif'
        ) THEN
          ALTER TABLE "epargnes"
            ADD CONSTRAINT "CHK_epargnes_objectif_montant_positif"
            CHECK ("objectif_montant" IS NULL OR "objectif_montant" > 0);
        END IF;
      END $$;
    `);

    // 1. Remettre NOT NULL sur date_echeance (peut échouer si des lignes sont NULL).
    await queryRunner.query(
      `ALTER TABLE "epargnes" ALTER COLUMN "date_echeance" SET NOT NULL`,
    );
  }
}
