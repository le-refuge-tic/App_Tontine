import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JetonRafraichissement } from './entities/jeton-rafraichissement.entity';
import { JetonRafraichissementService } from './jeton-rafraichissement.service';

@Module({
  imports: [TypeOrmModule.forFeature([JetonRafraichissement])],
  providers: [JetonRafraichissementService],
  exports: [JetonRafraichissementService],
})
export class JetonRafraichissementModule {}
