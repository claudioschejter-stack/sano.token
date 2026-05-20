import { Module } from '@nestjs/common';
import { EventsController } from '../controllers/events.controller';
import { FinanceEventsService } from './finance-events.service';

@Module({
  controllers: [EventsController],
  providers: [FinanceEventsService],
  exports: [FinanceEventsService]
})
export class EventsModule {}
