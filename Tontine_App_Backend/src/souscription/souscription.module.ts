import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Souscription } from './entities/souscription.entity';
import { Cycle } from '../cycle/entities/cycle.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { ParametreSystemeModule } from '../parametre-systeme/parametre-systeme.module';
import { SouscriptionService } from './souscription.service';
import { SouscriptionController } from './souscription.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Souscription, Cycle, Portefeuille]),
    ParametreSystemeModule,
  ],
  providers: [SouscriptionService],
  controllers: [SouscriptionController],
  exports: [SouscriptionService],
})
export class SouscriptionModule {}
