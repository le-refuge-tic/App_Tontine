import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Portefeuille } from './entities/portefeuille.entity';
import { PortefeuilleService } from './portefeuille.service';
import { PortefeuilleController } from './portefeuille.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Portefeuille])],
  providers: [PortefeuilleService],
  controllers: [PortefeuilleController],
  exports: [PortefeuilleService],
})
export class PortefeuilleModule {}
