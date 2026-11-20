import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cycle } from './entities/cycle.entity';
import { JourCotisation } from '../jour-cotisation/entities/jour-cotisation.entity';
import { SouscriptionModule } from '../souscription/souscription.module';
import { CycleService } from './cycle.service';
import { CycleController } from './cycle.controller';
import { AdminCycleController } from './admin-cycle.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Cycle, JourCotisation]),
    SouscriptionModule,
  ],
  providers: [CycleService],
  controllers: [CycleController, AdminCycleController],
  exports: [CycleService],
})
export class CycleModule {}
