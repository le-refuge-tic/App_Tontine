import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : dépôts FedaPay.
 *
 * 1. Colonne `jours_cibles` (jsonb) sur `transactions`.
 * 2. Colonne `id_fedapay_ref` + index unique partiel sur `webhooks_fedapay`.
 * 3. Triggers d'immuabilité sur `ecritures_comptables`.
 * 4. Triggers d'immuabilité sur `caisse_application`.
 */
export class DepotsFedapay1795100000000 implements MigrationInterface {
  name = 'DepotsFedapay1795100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Colonne jours_cibles sur transactions
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "jours_cibles" jsonb NULL`,
    );

    // 2. idFedapayRef + index unique partiel sur webhooks_fedapay
    await queryRunner.query(
      `ALTER TABLE "webhooks_fedapay" ADD COLUMN IF NOT EXISTS "id_fedapay_ref" character varying NULL`,
    );
    await queryRunner.query(
      `CREATE UNIQUE INDEX IF NOT EXISTS "idx_webhook_fedapay_ref_evenement"
       ON "webhooks_fedapay"("id_fedapay_ref", "evenement")
       WHERE "id_fedapay_ref" IS NOT NULL`,
    );

    // 3. Trigger immuabilité ecritures_comptables
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION protect_ecritures_comptables()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Les écritures comptables sont immuables.';
      END;
      $$
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_ecritures_no_update ON "ecritures_comptables"
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_ecritures_no_update
        BEFORE UPDATE ON "ecritures_comptables"
        FOR EACH ROW EXECUTE FUNCTION protect_ecritures_comptables()
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_ecritures_no_delete ON "ecritures_comptables"
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_ecritures_no_delete
        BEFORE DELETE ON "ecritures_comptables"
        FOR EACH ROW EXECUTE FUNCTION protect_ecritures_comptables()
    `);

    // 4. Trigger immuabilité caisse_application
    await queryRunner.query(`
      CREATE OR REPLACE FUNCTION protect_caisse_application()
      RETURNS TRIGGER LANGUAGE plpgsql AS $$
      BEGIN
        RAISE EXCEPTION 'Les entrées de caisse sont immuables.';
      END;
      $$
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_caisse_no_update ON "caisse_application"
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_caisse_no_update
        BEFORE UPDATE ON "caisse_application"
        FOR EACH ROW EXECUTE FUNCTION protect_caisse_application()
    `);
    await queryRunner.query(`
      DROP TRIGGER IF EXISTS trg_caisse_no_delete ON "caisse_application"
    `);
    await queryRunner.query(`
      CREATE TRIGGER trg_caisse_no_delete
        BEFORE DELETE ON "caisse_application"
        FOR EACH ROW EXECUTE FUNCTION protect_caisse_application()
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 4. Supprimer triggers caisse_application
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_caisse_no_delete ON "caisse_application"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_caisse_no_update ON "caisse_application"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS protect_caisse_application()`,
    );

    // 3. Supprimer triggers ecritures_comptables
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_ecritures_no_delete ON "ecritures_comptables"`,
    );
    await queryRunner.query(
      `DROP TRIGGER IF EXISTS trg_ecritures_no_update ON "ecritures_comptables"`,
    );
    await queryRunner.query(
      `DROP FUNCTION IF EXISTS protect_ecritures_comptables()`,
    );

    // 2. Supprimer index et colonne webhooks_fedapay
    await queryRunner.query(
      `DROP INDEX IF EXISTS "idx_webhook_fedapay_ref_evenement"`,
    );
    await queryRunner.query(
      `ALTER TABLE "webhooks_fedapay" DROP COLUMN IF EXISTS "id_fedapay_ref"`,
    );

    // 1. Supprimer colonne transactions
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "jours_cibles"`,
    );
  }
}
