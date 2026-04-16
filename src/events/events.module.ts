import { Module } from '@nestjs/common';
import { RabbitMQModule } from '@golevelup/nestjs-rabbitmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventsService } from './events.service';
import { SCROLLER_DLX, SCROLLER_EXCHANGE } from './events.constants';

@Module({
  imports: [
    RabbitMQModule.forRootAsync(RabbitMQModule, {
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => ({
        exchanges: [
          { name: SCROLLER_EXCHANGE, type: 'topic' },
          { name: SCROLLER_DLX, type: 'direct' },
        ],
        uri: config.get<string>('rabbitmq.url', 'amqp://guest:guest@localhost:5672'),
        // Don't block app startup if RabbitMQ is temporarily unavailable
        connectionInitOptions: { wait: false },
      }),
      inject: [ConfigService],
    }),
  ],
  providers: [EventsService],
  exports: [EventsService],
})
export class EventsModule {}
