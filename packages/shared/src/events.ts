import { Redis } from "ioredis";
import type { EventName, DomainEvent, EventPayloadMap } from "./types.js";

const CHANNEL = "petwell.events";

type Handler<T extends EventName> = (event: DomainEvent<T>) => Promise<void> | void;

export class RedisBus {
  private readonly publisher: Redis;

  private readonly subscriber: Redis;

  constructor(redisUrl: string) {
    this.publisher = new Redis(redisUrl);
    this.subscriber = new Redis(redisUrl);
  }

  async publish<T extends EventName>(
    name: T,
    payload: EventPayloadMap[T],
    correlationId: string
  ): Promise<void> {
    const event: DomainEvent<T> = {
      name,
      payload,
      correlationId,
      occurredAt: new Date().toISOString()
    };
    await this.publisher.publish(CHANNEL, JSON.stringify(event));
  }

  async subscribe(handlers: Partial<{ [K in EventName]: Handler<K> }>): Promise<void> {
    await this.subscriber.subscribe(CHANNEL);

    this.subscriber.on("message", async (_channel: string, raw: string) => {
      try {
        const event = JSON.parse(raw) as DomainEvent;
        const handler = handlers[event.name] as Handler<EventName> | undefined;
        if (!handler) {
          return;
        }
        await handler(event as never);
      } catch (error) {
        console.error("Failed to process event", error);
      }
    });
  }
}
