import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JourCotisation } from './entities/jour-cotisation.entity';
import { JourCotisationService } from './jour-cotisation.service';
import { JourCotisationController } from './jour-cotisation.controller';

@Module({
  imports: [TypeOrmModule.forFeature([JourCotisation])],
  providers: [JourCotisationService],
  controllers: [JourCotisationController],
  exports: [JourCotisationService],
})
export class JourCotisationModule {}
