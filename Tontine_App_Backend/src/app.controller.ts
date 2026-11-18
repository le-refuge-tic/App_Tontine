import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

/**
 * Contrôleur de santé. La route `GET /api/v1/health` est publique (@Public).
 */
@ApiTags('health')
@Controller('health')
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  getHealth(): { status: string } {
    return this.appService.getHealth();
  }
}
