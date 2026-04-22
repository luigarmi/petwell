import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { Injectable, LoggerService, Scope } from '@nestjs/common';

import { getCorrelationId } from './request-context';

type LogLevel = 'log' | 'error' | 'warn' | 'debug' | 'verbose';

@Injectable({ scope: Scope.TRANSIENT })
export class JsonLogger implements LoggerService {
  private serviceName = 'petwell-service';
  private logFilePath?: string;

  setContext(serviceName: string, logFilePath?: string) {
    this.serviceName = serviceName;
    this.logFilePath = logFilePath;
  }

  log(message: unknown, context?: string) {
    this.write('log', message, context);
  }

  error(message: unknown, trace?: string, context?: string) {
    this.write('error', message, context, trace ? { trace } : undefined);
  }

  warn(message: unknown, context?: string) {
    this.write('warn', message, context);
  }

  debug(message: unknown, context?: string) {
    this.write('debug', message, context);
  }

  verbose(message: unknown, context?: string) {
    this.write('verbose', message, context);
  }

  private write(level: LogLevel, message: unknown, context?: string, extra?: Record<string, unknown>) {
    const payload = {
      timestamp: new Date().toISOString(),
      level,
      service: this.serviceName,
      correlationId: getCorrelationId(),
      context,
      message: typeof message === 'string' ? message : JSON.stringify(message),
      ...extra
    };

    const line = JSON.stringify(payload);
    const writer = level === 'error' || level === 'warn' ? console.error : console.log;
    writer(line);

    if (this.logFilePath) {
      if (!existsSync(dirname(this.logFilePath))) {
        mkdirSync(dirname(this.logFilePath), { recursive: true });
      }

      appendFileSync(this.logFilePath, `${line}\n`, 'utf8');
    }
  }
}
