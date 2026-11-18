import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CaisseApplication } from './entities/caisse-application.entity';
import { CaisseApplicationService } from './caisse-application.service';
import { CaisseApplicationController } from './caisse-application.controller';

@Module({
  imports: [TypeOrmModule.forFeature([CaisseApplication])],
  providers: [CaisseApplicationService],
  controllers: [CaisseApplicationController],
  exports: [CaisseApplicationService],
})
export class CaisseApplicationModule {}
