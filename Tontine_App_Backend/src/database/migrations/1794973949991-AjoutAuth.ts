import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration d'authentification.
 * Ajoute :
 *  - 4 colonnes techniques anti-bruteforce sur la table `membres`
 *    (tentatives_connexion_echouees, connexion_bloquee_jusqua,
 *     tentatives_code_retrait_echouees, code_retrait_bloque_jusqua)
 *  - La table `jetons_rafraichissement` (refresh tokens, stockés en hash SHA-256)
 */
export class AjoutAuth1794973949991 implements MigrationInterface {
  name = 'AjoutAuth1794973949991';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // ---- Colonnes anti-bruteforce sur membres ----
    await queryRunner.query(`
      ALTER TABLE "membres"
        ADD COLUMN IF NOT EXISTS "tentatives_connexion_echouees" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "connexion_bloquee_jusqua"      TIMESTAMP WITH TIME ZONE,
        ADD COLUMN IF NOT EXISTS "tentatives_code_retrait_echouees" integer NOT NULL DEFAULT 0,
        ADD COLUMN IF NOT EXISTS "code_retrait_bloque_jusqua"    TIMESTAMP WITH TIME ZONE
    `);

    // ---- Table des jetons de rafraîchissement ----
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "jetons_rafraichissement" (
        "id"          SERIAL                      NOT NULL,
        "hash_jeton"  character varying           NOT NULL,
        "expire_le"   TIMESTAMP WITH TIME ZONE    NOT NULL,
        "revoque_le"  TIMESTAMP WITH TIME ZONE,
        "cree_le"     TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT now(),
        "membre_id"   integer                     NOT NULL,
        CONSTRAINT "UQ_jetons_hash_jeton" UNIQUE ("hash_jeton"),
        CONSTRAINT "PK_jetons_rafraichissement" PRIMARY KEY ("id")
      )
    `);

    await queryRunner.query(`
      ALTER TABLE "jetons_rafraichissement"
        ADD CONSTRAINT "FK_jetons_membre_id"
        FOREIGN KEY ("membre_id")
        REFERENCES "membres"("id")
        ON DELETE RESTRICT
    `);

    // Index pour accélerer la recherche par hash (lookup à chaque requête authentifiée)
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_jetons_hash_jeton"
      ON "jetons_rafraichissement" ("hash_jeton")
    `);

    // Index pour la révocation de tous les jetons d'un membre
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_jetons_membre_id"
      ON "jetons_rafraichissement" ("membre_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "jetons_rafraichissement"`);

    await queryRunner.query(`
      ALTER TABLE "membres"
        DROP COLUMN IF EXISTS "code_retrait_bloque_jusqua",
        DROP COLUMN IF EXISTS "tentatives_code_retrait_echouees",
        DROP COLUMN IF EXISTS "connexion_bloquee_jusqua",
        DROP COLUMN IF EXISTS "tentatives_connexion_echouees"
    `);
  }
}
