import { Controller } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

/**
 * Contrôleur des retraits d'épargne.
 *
 * Intentionnellement vide : aucune route n'est exposée ici. La route de retrait
 * d'épargne `POST /epargnes/:id/retraits` est déclarée par `EpargneController`,
 * qui délègue à `RetraitEpargneService`. Ce contrôleur n'est pas enregistré dans
 * `RetraitEpargneModule` (controllers: []). Il est conservé comme point
 * d'extension futur si des routes dédiées `/retraits-epargne` deviennent
 * nécessaires (liste, détail).
 */
@ApiTags('retraits-epargne')
@Controller('retraits-epargne')
export class RetraitEpargneController {}
