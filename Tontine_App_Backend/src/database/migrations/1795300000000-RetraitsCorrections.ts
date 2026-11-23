import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : corrections prompt 5b.
 *
 * 1. Table `jetons_retrait_consommes` pour l'usage unique du jeton de retrait.
 * 2. Nouvelle valeur `liberation_fonds` dans l'enum `type_ecriture`.
 */
export class RetraitsCorrections1795300000000 implements MigrationInterface {
  name = 'RetraitsCorrections1795300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Table jetons_retrait_consommes
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "jetons_retrait_consommes" (
        "id"           SERIAL PRIMARY KEY,
        "jti"          character varying NOT NULL,
        "expire_le"    timestamptz       NOT NULL,
        "consomme_le"  timestamptz       NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_jetons_retrait_consommes_jti" UNIQUE ("jti")
      )
    `);

    // Index pour le nettoyage périodique par date d'expiration.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_jetons_retrait_consommes_expire_le"
      ON "jetons_retrait_consommes" ("expire_le")
    `);

    // 2. Ajouter liberation_fonds à l'enum type_ecriture.
    // Note : TypeORM stocke TypeEcriture en varchar (pas un vrai type PG ENUM).
    // Aucune DDL requise côté base de données : la valeur 'liberation_fonds'
    // est simplement acceptée par la colonne varchar existante.
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Supprimer la table (la valeur d'enum ne peut pas être retirée en PG).
    await queryRunner.query(`
      DROP INDEX IF EXISTS "IDX_jetons_retrait_consommes_expire_le"
    `);
    await queryRunner.query(`
      DROP TABLE IF EXISTS "jetons_retrait_consommes"
    `);
    // Note : PostgreSQL ne permet pas de supprimer une valeur d'enum.
    // La valeur 'liberation_fonds' reste dans le type mais inutilisée.
  }
}
