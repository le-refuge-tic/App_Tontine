import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membre } from './entities/membre.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { MembreService } from './membre.service';
import { MembreController } from './membre.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Membre, Portefeuille])],
  providers: [MembreService],
  controllers: [MembreController],
  exports: [MembreService],
})
export class MembreModule {}
