declare module 'amqplib' {
  export type Connection = {
    createChannel: () => Promise<Channel>;
    close: () => Promise<void>;
  };

  export type Channel = {
    assertExchange: (exchange: string, type: string, options?: Record<string, unknown>) => Promise<unknown>;
    assertQueue: (queue: string, options?: Record<string, unknown>) => Promise<unknown>;
    bindQueue: (queue: string, exchange: string, routingKey: string) => Promise<unknown>;
    consume: (
      queue: string,
      onMessage: (message: ConsumeMessage | null) => Promise<void> | void
    ) => Promise<unknown>;
    publish: (
      exchange: string,
      routingKey: string,
      content: Buffer,
      options?: Record<string, unknown>
    ) => boolean;
    sendToQueue: (queue: string, content: Buffer, options?: Record<string, unknown>) => boolean;
    ack: (message: ConsumeMessage) => void;
    close: () => Promise<void>;
  };

  export type ConsumeMessage = {
    fields: { routingKey: string };
    properties: {
      contentType?: string;
      headers?: Record<string, unknown>;
      messageId?: string;
    };
    content: Buffer;
  };

  export function connect(url: string): Promise<Connection>;

  const amqp: {
    connect: typeof connect;
  };

  export default amqp;
}
