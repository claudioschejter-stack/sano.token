import { Controller, MessageEvent, Sse } from '@nestjs/common';
import { Observable } from 'rxjs';
import { FinanceEventsService } from '../events/finance-events.service';

/** Ruta efectiva con prefijo global: GET /api/v1/finance/stream */
@Controller('finance')
export class EventsController {
  constructor(private readonly financeEventsService: FinanceEventsService) {}

  @Sse('stream')
  streamFinanceEvents(): Observable<MessageEvent> {
    return this.financeEventsService.observeFinanceStream();
  }
}
