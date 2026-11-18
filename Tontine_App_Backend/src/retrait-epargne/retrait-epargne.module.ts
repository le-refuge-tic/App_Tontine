import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RetraitEpargne } from './entities/retrait-epargne.entity';
import { Epargne } from '../epargne/entities/epargne.entity';
import { Transaction } from '../transaction/entities/transaction.entity';
import { RetraitEpargneService } from './retrait-epargne.service';
import { RetraitEpargneController } from './retrait-epargne.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RetraitEpargne, Epargne, Transaction])],
  providers: [RetraitEpargneService],
  controllers: [RetraitEpargneController],
  exports: [RetraitEpargneService],
})
export class RetraitEpargneModule {}
