import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Garantie } from './entities/garantie.entity';
import { Pret } from '../pret/entities/pret.entity';
import { Membre } from '../membre/entities/membre.entity';
import { GarantieService } from './garantie.service';
import { GarantieController } from './garantie.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Garantie, Pret, Membre])],
  providers: [GarantieService],
  controllers: [GarantieController],
  exports: [GarantieService],
})
export class GarantieModule {}
