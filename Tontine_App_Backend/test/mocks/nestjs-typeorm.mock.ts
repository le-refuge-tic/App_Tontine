import { Inject } from '@nestjs/common';

/**
 * Stub CJS de `@nestjs/typeorm` pour Jest.
 *
 * Raison : `@nestjs/typeorm` 12 est publié en ESM pur (`"type": "module"`),
 * incompatible avec ts-jest qui compile en CommonJS. Importer un service qui
 * déclare `@InjectRepository(...)` fait donc planter le runtime Jest :
 * "Must use import to load ES Module".
 *
 * Ce stub reproduit la logique de génération des tokens d'injection de la
 * vraie bibliothèque afin que les tests unitaires puissent injecter des mocks
 * de repositories sous le token `${Entity.name}Repository`.
 *
 * Logique répliquée (identique à @nestjs/typeorm) :
 *   getRepositoryToken(entity) = `${dataSourcePrefix}${entity.name}Repository`
 *   avec dataSourcePrefix = '' quand le dataSource est celui par défaut ('default').
 *   Donc getRepositoryToken(Membre) = 'MembreRepository'.
 *
 * Les services n'importent que `InjectRepository` depuis `@nestjs/typeorm` ;
 * `TypeOrmModule` est stubbé pour les éventuels fichiers de module transitivement
 * chargés (non utilisés dans les tests unitaires de services).
 */

export const DEFAULT_DATA_SOURCE_NAME = 'default';

export function getRepositoryToken(entity: { name: string }): string {
  if (entity === null || entity === undefined) {
    throw new Error('@InjectRepository() requiert une entité.');
  }
  return `${entity.name}Repository`;
}

export function getDataSourceToken(dataSource: unknown): string | symbol {
  return typeof dataSource === 'string' && dataSource !== DEFAULT_DATA_SOURCE_NAME
    ? `${dataSource}DataSource`
    : Symbol.for('DataSource');
}

// InjectRepository reproduit exactement la vraie implémentation :
//   export const InjectRepository = (entity, dataSource) =>
//     Inject(getRepositoryToken(entity, dataSource));
export const InjectRepository = (
  entity: { name: string },
  _dataSource?: unknown,
): ParameterDecorator => Inject(getRepositoryToken(entity)) as ParameterDecorator;

/**
 * Stub minimal de TypeOrmModule. Les méthodes renvoient un DynamicModule vide.
 * Non utilisé par les tests unitaires (qui ne montent que des services), mais
 * présent pour ne pas casser les imports de fichiers `*.module.ts` transitifs.
 */
const stubModule = { module: class TypeOrmStubModule {}, providers: [] as unknown[] };
export const TypeOrmModule = {
  forRoot: () => stubModule,
  forRootAsync: () => stubModule,
  forFeature: () => stubModule,
};
