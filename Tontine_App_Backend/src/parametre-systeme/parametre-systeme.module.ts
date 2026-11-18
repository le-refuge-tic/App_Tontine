import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ParametreSysteme } from './entities/parametre-systeme.entity';
import { ParametreSystemeService } from './parametre-systeme.service';
import { ParametreSystemeController } from './parametre-systeme.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ParametreSysteme])],
  providers: [ParametreSystemeService],
  controllers: [ParametreSystemeController],
  exports: [ParametreSystemeService],
})
export class ParametreSystemeModule {}
