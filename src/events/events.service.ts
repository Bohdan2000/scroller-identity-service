import { Injectable, Logger } from '@nestjs/common';
import { AmqpConnection } from '@golevelup/nestjs-rabbitmq';
import { SCROLLER_EXCHANGE } from './events.constants';

@Injectable()
export class EventsService {
  private readonly logger = new Logger(EventsService.name);

  constructor(private readonly amqpConnection: AmqpConnection) {}

  async publish(routingKey: string, payload: Record<string, unknown>): Promise<void> {
    try {
      await this.amqpConnection.publish(SCROLLER_EXCHANGE, routingKey, payload);
      this.logger.debug(`[EVENT] published ${routingKey} ${JSON.stringify(payload)}`);
    } catch (err) {
      this.logger.error(`[EVENT] failed to publish ${routingKey}: ${String(err)}`);
    }
  }
}
