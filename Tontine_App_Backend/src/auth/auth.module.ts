import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Membre } from '../membre/entities/membre.entity';
import { Portefeuille } from '../portefeuille/entities/portefeuille.entity';
import { JetonRafraichissementModule } from '../jeton-rafraichissement/jeton-rafraichissement.module';
import { ParametreSystemeModule } from '../parametre-systeme/parametre-systeme.module';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        // Pas de signOptions globaux : chaque appel à jwtService.sign()
        // précise audience + expiresIn selon le type de token.
      }),
    }),
    TypeOrmModule.forFeature([Membre, Portefeuille]),
    JetonRafraichissementModule,
    ParametreSystemeModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtStrategy, JwtModule],
})
export class AuthModule {}
