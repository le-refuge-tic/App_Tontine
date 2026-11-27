import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Migration : ajout du vocabulaire « projet » à la table epargnes (prompt 7).
 *
 * Ajoute deux colonnes à la table `epargnes` :
 * 1. `nom` (varchar 100, NOT NULL, défaut 'Mon projet') : nom donné par le
 *    membre pour identifier son projet d'épargne. Visible dans les vues GET et
 *    dans le rapport mensuel (champ `projetNom`).
 * 2. `objectif_montant` (integer, nullable, > 0) : montant cible optionnel. Si
 *    renseigné, permet de calculer la progression en pourcentage (plafonné à
 *    100 %) renvoyée dans les vues GET.
 *
 * Aucune modification sur les tables existantes. Les routes /epargnes, les
 * valeurs d'enum du grand livre et les calculs de pénalités/retenues restent
 * inchangés.
 *
 * TODO(decision) : questions métier restant à clarifier pour les prochaines
 *                  itérations :
 *   - Pénalité de retrait anticipé : taux actuel (5 %) OK ? Quelle part va
 *     au fonds de caisse (% du montant retenu) ?
 *   - Durée du projet : libre ou fixée ? Paiement en une fois ou régulier ?
 *   - Objectif obligatoire ou optionnel (choix actuel) ? Nombre maximum de
 *     projets par membre ?
 *   - Que se passe-t-il à l'échéance : retrait libre sans frais, avec frais,
 *     ou retrait automatique ?
 */
export class AjoutProjet1795600000000 implements MigrationInterface {
  name = 'AjoutProjet1795600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Colonne nom (varchar 100, NOT NULL, défaut 'Mon projet').
    await queryRunner.query(
      `ALTER TABLE "epargnes" ADD COLUMN IF NOT EXISTS "nom" varchar(100) NOT NULL DEFAULT 'Mon projet'`,
    );

    // 2. Colonne objectif_montant (integer, nullable, CHECK > 0).
    await queryRunner.query(
      `ALTER TABLE "epargnes" ADD COLUMN IF NOT EXISTS "objectif_montant" integer NULL`,
    );
    // Contrainte CHECK : si renseigné, doit être > 0.
    await queryRunner.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'CHK_epargnes_objectif_montant_positif'
        ) THEN
          ALTER TABLE "epargnes"
            ADD CONSTRAINT "CHK_epargnes_objectif_montant_positif"
            CHECK ("objectif_montant" IS NULL OR "objectif_montant" > 0);
        END IF;
      END $$;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Retirer la contrainte CHECK puis les colonnes.
    await queryRunner.query(
      `ALTER TABLE "epargnes" DROP CONSTRAINT IF EXISTS "CHK_epargnes_objectif_montant_positif"`,
    );
    await queryRunner.query(
      `ALTER TABLE "epargnes" DROP COLUMN IF EXISTS "objectif_montant"`,
    );
    await queryRunner.query(
      `ALTER TABLE "epargnes" DROP COLUMN IF EXISTS "nom"`,
    );
  }
}
