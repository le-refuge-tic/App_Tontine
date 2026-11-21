import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FEDAPAY_CLIENT } from './fedapay-client.interface';
import { FedapayClientImpl } from './fedapay-client.impl';

/**
 * Module FedaPay. Fournit `FEDAPAY_CLIENT` (token Symbol) pour injection dans
 * les autres modules. L'implémentation réelle est utilisée en production ;
 * les tests injectent `FedapayClientFaux` directement.
 */
@Module({
  providers: [
    {
      provide: FEDAPAY_CLIENT,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => new FedapayClientImpl(config),
    },
  ],
  exports: [FEDAPAY_CLIENT],
})
export class FedapayModule {}
