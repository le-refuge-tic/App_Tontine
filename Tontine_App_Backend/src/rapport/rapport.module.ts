import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { RapportService } from './rapport.service';
import { RapportController } from './rapport.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EcritureComptable])],
  providers: [RapportService],
  controllers: [RapportController],
})
export class RapportModule {}
