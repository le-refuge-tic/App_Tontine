import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Remboursement } from './entities/remboursement.entity';
import { Pret } from '../pret/entities/pret.entity';
import { EcritureComptable } from '../ecriture-comptable/entities/ecriture-comptable.entity';
import { RemboursementService } from './remboursement.service';
import { RemboursementController } from './remboursement.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Remboursement, Pret, EcritureComptable])],
  providers: [RemboursementService],
  controllers: [RemboursementController],
  exports: [RemboursementService],
})
export class RemboursementModule {}
