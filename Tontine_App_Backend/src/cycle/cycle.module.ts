import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cycle } from './entities/cycle.entity';
import { JourCotisation } from '../jour-cotisation/entities/jour-cotisation.entity';
import { CycleService } from './cycle.service';
import { CycleController } from './cycle.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cycle, JourCotisation])],
  providers: [CycleService],
  controllers: [CycleController],
  exports: [CycleService],
})
export class CycleModule {}
