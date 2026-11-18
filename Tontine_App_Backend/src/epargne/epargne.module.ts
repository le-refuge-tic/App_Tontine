import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Epargne } from './entities/epargne.entity';
import { Membre } from '../membre/entities/membre.entity';
import { EpargneService } from './epargne.service';
import { EpargneController } from './epargne.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Epargne, Membre])],
  providers: [EpargneService],
  controllers: [EpargneController],
  exports: [EpargneService],
})
export class EpargneModule {}
