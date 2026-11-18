/**
 * Convertit un identifiant camelCase (ou mêlant majuscules) en snake_case.
 * Les tirets et espaces sont aussi transformés en underscores.
 *
 * Exemples : miseBase -> mise_base, montantARembourser -> montant_a_rembourser.
 */
export function toSnakeCase(input: string): string {
  if (input === '') {
    return '';
  }
  return input
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/[-\s]+/g, '_')
    .toLowerCase();
}
