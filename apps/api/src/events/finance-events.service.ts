import { Injectable, Logger, MessageEvent } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Observable, Subject } from 'rxjs';
import {
  DIVIDEND_PROCESSED_EVENT,
  type DividendProcessedEvent,
  type FinanceStreamMessage
} from './dividend.events';

@Injectable()
export class FinanceEventsService {
  private readonly logger = new Logger(FinanceEventsService.name);
  private readonly dividendStream$ = new Subject<MessageEvent>();

  @OnEvent(DIVIDEND_PROCESSED_EVENT)
  handleDividendProcessed(payload: DividendProcessedEvent): void {
    const message: FinanceStreamMessage = {
      type: 'DIVIDEND_PROCESSED',
      payload
    };

    this.logger.debug(`Broadcasting SSE dividend txHash=${payload.txHash}`);
    this.dividendStream$.next({ data: message });
  }

  observeFinanceStream(): Observable<MessageEvent> {
    return this.dividendStream$.asObservable();
  }
}
