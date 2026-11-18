import { DefaultNamingStrategy } from 'typeorm';
import { toSnakeCase } from '../utils/case.utils';

/**
 * Stratégie de nommage snake_case.
 *
 * Les propriétés restent en camelCase dans le code TypeScript, mais les noms
 * générés en base (tables, colonnes, clés étrangères xxx_id) le sont en
 * snake_case. Les noms de contraintes (PK, FK, UQ, IDX, CHK) sont hérités du
 * `DefaultNamingStrategy` de TypeORM.
 *
 * Implémentation locale : le paquet `typeorm-naming-strategies` ne supporte pas
 * TypeORM 1.x (ses peerDependencies restreignent à `^0.2.0 || ^0.3.0`). Cette
 * classe reproduit fidèlement son `SnakeNamingStrategy` pour TypeORM 1.x,
 * sans ajouter de dépendance.
 */
export class SnakeNamingStrategy extends DefaultNamingStrategy {
  override tableName(targetName: string, userSpecifiedName: string | undefined): string {
    return userSpecifiedName ?? toSnakeCase(targetName);
  }

  override columnName(
    propertyName: string,
    customName: string | undefined,
    embeddedPrefixes: string[],
  ): string {
    const prefix = embeddedPrefixes.length ? `${toSnakeCase(embeddedPrefixes.join('_'))}_` : '';
    return prefix + (customName ?? toSnakeCase(propertyName));
  }

  override relationName(propertyName: string): string {
    return toSnakeCase(propertyName);
  }

  override joinColumnName(relationName: string, referencedColumnName: string): string {
    return toSnakeCase(`${relationName}_${referencedColumnName}`);
  }

  override joinTableName(
    firstTableName: string,
    secondTableName: string,
    firstPropertyName: string,
    secondPropertyName: string,
  ): string {
    return toSnakeCase(
      `${firstTableName}_${firstPropertyName}_${secondTableName}_${secondPropertyName}`,
    );
  }

  override joinTableColumnDuplicationPrefix(columnName: string, index: number): string {
    return toSnakeCase(`${columnName}_${index}`);
  }

  override joinTableColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(columnName ?? propertyName);
  }

  override joinTableInverseColumnName(
    tableName: string,
    propertyName: string,
    columnName?: string,
  ): string {
    return toSnakeCase(columnName ?? propertyName);
  }
}
