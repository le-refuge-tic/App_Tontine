import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  /** Indique que l'application est démarrée et répond. */
  getHealth(): { status: string } {
    return { status: 'ok' };
  }
}
