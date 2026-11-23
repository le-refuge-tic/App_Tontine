import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : retraits de cotisation.
 *
 * 1. Colonne `est_retrait_total` (boolean, default false) sur `transactions`.
 * 2. Paramètre système `pourcentage_frais_retrait` (défaut 0 %).
 */
export class Retraits1795200000000 implements MigrationInterface {
  name = 'Retraits1795200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Colonne est_retrait_total sur transactions.
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "est_retrait_total" boolean NOT NULL DEFAULT false`,
    );

    // 2. Paramètre système pour les frais de retrait.
    await queryRunner.query(
      `INSERT INTO "parametres_systeme" ("cle", "valeur", "description")
       VALUES ('pourcentage_frais_retrait', '0', 'Pourcentage des frais FedaPay sur les retraits (provisoire : 0%)')
       ON CONFLICT ("cle") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `DELETE FROM "parametres_systeme" WHERE "cle" = 'pourcentage_frais_retrait'`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "est_retrait_total"`,
    );
  }
}
