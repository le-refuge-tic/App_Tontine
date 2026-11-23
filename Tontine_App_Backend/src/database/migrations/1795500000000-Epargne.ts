import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : épargne (prompt 6).
 *
 * 1. Colonne `epargne_id` (integer, nullable) sur `transactions` + FK vers
 *    `epargnes` (ON DELETE RESTRICT). Permet d'aiguiller un dépôt/retrait vers
 *    la logique épargne dans `TransactionService.confirmer()`.
 * 2. Colonne `est_anticipe` (boolean, default false) sur `retraits_epargne`.
 *    Mémorise si le retrait a eu lieu avant la date d'échéance (pénalité 5 %)
 *    ou à/après (retenue 2,75 %), de façon robuste et indépendante des
 *    paramètres système (qui pourraient évoluer entre la création et la
 *    confirmation webhook).
 * 3. Paramètre système `epargne_minimale` (défaut 1) : mise minimale d'un
 *    dépôt d'épargne. Provisionné ici (idempotent) pour qu'un simple
 *    `migration:run` le rende disponible, sans nécessiter de ré-exécuter le
 *    seed. Le seed l'upserte également pour les installations fraîches.
 *
 * Aucune valeur d'enum à ajouter : `epargne`, `retrait_epargne`, `penalite`,
 * `retenue_epargne` (type d'écriture), `penalite`, `retenue_epargne` (source
 * de caisse) et `retiree`/`cloturee` (statut d'épargne) existent déjà depuis
 * la migration Init.
 */
export class Epargne1795500000000 implements MigrationInterface {
  name = 'Epargne1795500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Colonne epargne_id sur transactions.
    await queryRunner.query(
      `ALTER TABLE "transactions" ADD COLUMN IF NOT EXISTS "epargne_id" integer NULL`,
    );
    // FK epargne_id -> epargnes (RESTRICT, comme toute la partie argent).
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'FK_transactions_epargne_id'
        ) THEN
          ALTER TABLE "transactions"
            ADD CONSTRAINT "FK_transactions_epargne_id"
            FOREIGN KEY ("epargne_id") REFERENCES "epargnes"("id")
            ON DELETE RESTRICT ON UPDATE NO ACTION;
        END IF;
      END $$;
    `);

    // 2. Colonne est_anticipe sur retraits_epargne.
    await queryRunner.query(
      `ALTER TABLE "retraits_epargne" ADD COLUMN IF NOT EXISTS "est_anticipe" boolean NOT NULL DEFAULT false`,
    );

    // 3. Paramètre système epargne_minimale.
    await queryRunner.query(
      `INSERT INTO "parametres_systeme" ("cle", "valeur", "description")
       VALUES ('epargne_minimale', '1', 'Montant minimal d''un dépôt d''épargne (FCFA)')
       ON CONFLICT ("cle") DO NOTHING`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 3. Retirer le paramètre.
    await queryRunner.query(
      `DELETE FROM "parametres_systeme" WHERE "cle" = 'epargne_minimale'`,
    );

    // 2. Retirer la colonne est_anticipe.
    await queryRunner.query(
      `ALTER TABLE "retraits_epargne" DROP COLUMN IF EXISTS "est_anticipe"`,
    );

    // 1. Retirer la FK puis la colonne epargne_id.
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "FK_transactions_epargne_id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "transactions" DROP COLUMN IF EXISTS "epargne_id"`,
    );
  }
}
