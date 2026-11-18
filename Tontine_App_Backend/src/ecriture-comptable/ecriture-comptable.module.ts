import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EcritureComptable } from './entities/ecriture-comptable.entity';
import { EcritureComptableService } from './ecriture-comptable.service';
import { EcritureComptableController } from './ecriture-comptable.controller';

@Module({
  imports: [TypeOrmModule.forFeature([EcritureComptable])],
  providers: [EcritureComptableService],
  controllers: [EcritureComptableController],
  exports: [EcritureComptableService],
})
export class EcritureComptableModule {}
