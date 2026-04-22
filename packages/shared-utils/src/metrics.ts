import { Counter, Histogram, Registry, collectDefaultMetrics } from 'prom-client';

const METRICS_PREFIX = 'petwell_';

export function createMetricsRegistry(serviceName: string) {
  const registry = new Registry();
  collectDefaultMetrics({ prefix: `${METRICS_PREFIX}${serviceName.replace(/-/g, '_')}_`, register: registry });

  const httpRequests = new Counter({
    name: `${METRICS_PREFIX}http_requests_total`,
    help: 'Total HTTP requests by service and route',
    labelNames: ['service', 'method', 'route', 'status_code'],
    registers: [registry]
  });

  const httpLatency = new Histogram({
    name: `${METRICS_PREFIX}http_request_duration_seconds`,
    help: 'Latency histogram by service and route',
    labelNames: ['service', 'method', 'route', 'status_code'],
    buckets: [0.05, 0.1, 0.25, 0.5, 1, 2, 5],
    registers: [registry]
  });

  return { registry, httpRequests, httpLatency };
}
