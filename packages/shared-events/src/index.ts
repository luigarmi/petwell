import type { Channel, Connection, ConsumeMessage } from 'amqplib';
import amqp from 'amqplib';
import { v4 as uuidv4 } from 'uuid';

import { EventEnvelope, EventName } from '@petwell/shared-types';

export interface EventBusOptions {
  serviceName: string;
  url: string;
  exchange?: string;
  maxRetries?: number;
  retryDelayMs?: number;
}

type EventHandler = (payload: unknown, envelope: EventEnvelope<unknown>) => Promise<void> | void;

export class RabbitMqEventBus {
  private connection?: Connection;
  private channel?: Channel;
  private readonly exchange: string;
  private readonly queueName: string;
  private readonly dlqName: string;
  private readonly handlers = new Map<string, EventHandler>();
  private readonly maxRetries: number;
  private readonly retryDelayMs: number;

  constructor(private readonly options: EventBusOptions) {
    this.exchange = options.exchange ?? 'petwell.events';
    this.queueName = `${options.serviceName}.events`;
    this.dlqName = `${options.serviceName}.events.dlq`;
    this.maxRetries = options.maxRetries ?? 3;
    this.retryDelayMs = options.retryDelayMs ?? 5000;
  }

  async connect() {
    if (this.channel) {
      return;
    }

    this.connection = await amqp.connect(this.options.url);
    this.channel = await this.connection.createChannel();
    await this.channel.assertExchange(this.exchange, 'topic', { durable: true });
    await this.channel.assertQueue(this.queueName, { durable: true });
    await this.channel.assertQueue(this.dlqName, { durable: true });

    for (const eventName of this.handlers.keys()) {
      await this.channel.bindQueue(this.queueName, this.exchange, eventName);
    }

    await this.channel.consume(this.queueName, async (message: ConsumeMessage | null) => {
      if (!message) {
        return;
      }

      await this.processMessage(message);
    });
  }

  async close() {
    await this.channel?.close();
    await this.connection?.close();
  }

  subscribe(eventName: EventName, handler: EventHandler) {
    this.handlers.set(eventName, handler);
  }

  async publish<TPayload>(eventName: EventName, payload: TPayload, metadata?: { eventId?: string; occurredAt?: string }) {
    if (!this.channel) {
      await this.connect();
    }

    const envelope: EventEnvelope<TPayload> = {
      eventName,
      occurredAt: metadata?.occurredAt ?? new Date().toISOString(),
      payload
    };

    this.channel!.publish(this.exchange, eventName, Buffer.from(JSON.stringify(envelope)), {
      contentType: 'application/json',
      persistent: true,
      messageId: metadata?.eventId ?? uuidv4()
    });
  }

  private async processMessage(message: ConsumeMessage) {
    const routingKey = message.fields.routingKey as EventName;
    const handler = this.handlers.get(routingKey);

    if (!handler) {
      this.channel?.ack(message);
      return;
    }

    try {
      const envelope = JSON.parse(message.content.toString('utf8')) as EventEnvelope<unknown>;
      await handler(envelope.payload, envelope);
      this.channel?.ack(message);
    } catch (error) {
      const retryCount = Number(message.properties.headers?.['x-retry-count'] ?? 0);

      if (retryCount >= this.maxRetries) {
        this.channel?.sendToQueue(
          this.dlqName,
          message.content,
          {
            contentType: message.properties.contentType,
            headers: {
              ...(message.properties.headers ?? {}),
              'x-original-routing-key': routingKey,
              'x-error-message': error instanceof Error ? error.message : 'Unknown event handler error'
            },
            persistent: true
          }
        );
        this.channel?.ack(message);
        return;
      }

      setTimeout(() => {
        void this.channel?.publish(this.exchange, routingKey, message.content, {
          contentType: message.properties.contentType,
          persistent: true,
          messageId: message.properties.messageId,
          headers: {
            ...(message.properties.headers ?? {}),
            'x-retry-count': retryCount + 1
          }
        });
      }, this.retryDelayMs);

      this.channel?.ack(message);
    }
  }
}

export function createEventPayload<TPayload>(payload: TPayload) {
  return {
    eventId: uuidv4(),
    ...payload
  };
}

export async function checkRabbitMqConnection(url: string) {
  const connection = await amqp.connect(url);

  try {
    const channel = await connection.createChannel();

    try {
      return {
        channelReady: true
      };
    } finally {
      await channel.close();
    }
  } finally {
    await connection.close();
  }
}
