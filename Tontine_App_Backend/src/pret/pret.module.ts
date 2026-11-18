import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Pret } from './entities/pret.entity';
import { Membre } from '../membre/entities/membre.entity';
import { PretService } from './pret.service';
import { PretController } from './pret.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Pret, Membre])],
  providers: [PretService],
  controllers: [PretController],
  exports: [PretService],
})
export class PretModule {}
