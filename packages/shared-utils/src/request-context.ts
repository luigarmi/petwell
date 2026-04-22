import { AsyncLocalStorage } from 'node:async_hooks';
import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

type RequestStore = {
  correlationId: string;
};

const requestStorage = new AsyncLocalStorage<RequestStore>();

export function getCorrelationId() {
  return requestStorage.getStore()?.correlationId;
}

export function runWithCorrelationId<T>(correlationId: string, callback: () => T) {
  return requestStorage.run({ correlationId }, callback);
}

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const correlationId = String(req.headers['x-correlation-id'] ?? randomUUID());

    res.setHeader('x-correlation-id', correlationId);
    req.headers['x-correlation-id'] = correlationId;

    runWithCorrelationId(correlationId, next);
  }
}
