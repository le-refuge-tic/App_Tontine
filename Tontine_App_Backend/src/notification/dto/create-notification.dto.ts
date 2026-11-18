import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { TypeNotification } from '../../common/enums';

export class CreateNotificationDto {
  @ApiProperty({ description: 'Membre destinataire.' })
  @IsInt()
  membreId!: number;

  @ApiProperty({ enum: TypeNotification, description: 'Type de notification.' })
  @IsEnum(TypeNotification)
  type!: TypeNotification;

  @ApiProperty({ description: 'Message de la notification.' })
  @IsString()
  message!: string;

  @ApiPropertyOptional({ example: false, description: 'Indique si la notification a été lue.' })
  @IsOptional()
  @IsBoolean()
  lue?: boolean;
}
