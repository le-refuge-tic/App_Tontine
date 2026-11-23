import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Ajoute la valeur `liberation_fonds` à l'enum PostgreSQL
 * `ecritures_comptables_type_enum`.
 *
 * Cette valeur est utilisée par `TransactionService.recalculerPortefeuille()`
 * lors d'un retrait total (libération des fonds de caisse retenus).
 *
 * Note : `ALTER TYPE ... ADD VALUE` est irréversible dans PostgreSQL — il n'y
 * a pas de `down()` possible sans recréer l'enum entier.
 */
export class AjoutLiberationFonds1795400000000 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE ecritures_comptables_type_enum ADD VALUE IF NOT EXISTS 'liberation_fonds'`,
    );
  }

  public async down(_queryRunner: QueryRunner): Promise<void> {
    // ALTER TYPE ... ADD VALUE est irréversible dans PostgreSQL.
    // Pour revenir en arrière, il faudrait recréer l'enum sans cette valeur,
    // ce qui nécessite de modifier toutes les colonnes qui l'utilisent.
  }
}
