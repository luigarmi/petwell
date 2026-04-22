export type HealthCheckType = 'broker' | 'cache' | 'database' | 'http' | 'provider' | 'smtp' | 'storage';

export type HealthOverallStatus = 'degraded' | 'error' | 'ok';

export interface HealthCheckDefinition {
  name: string;
  type: HealthCheckType;
  critical?: boolean;
  timeoutMs?: number;
  check: () => Promise<Record<string, unknown> | void>;
}

export interface HealthCheckResult {
  name: string;
  type: HealthCheckType;
  critical: boolean;
  status: 'down' | 'up';
  latencyMs: number;
  details?: Record<string, unknown>;
  error?: string;
}

export interface HealthReportSummary {
  total: number;
  up: number;
  down: number;
  criticalDown: number;
}

export interface LivenessReport {
  mode: 'live';
  ready: true;
  service: string;
  status: 'ok';
  timestamp: string;
  uptimeSeconds: number;
}

export interface ReadinessReport {
  checks: HealthCheckResult[];
  mode: 'ready';
  ready: boolean;
  service: string;
  status: HealthOverallStatus;
  summary: HealthReportSummary;
  timestamp: string;
  uptimeSeconds: number;
}

type PrismaClientLike = {
  $queryRawUnsafe: (query: string) => Promise<unknown>;
};

type HttpHealthCheckOptions = {
  critical?: boolean;
  path?: string;
  timeoutMs?: number;
};

export function createLivenessReport(service: string): LivenessReport {
  return {
    mode: 'live',
    ready: true,
    service,
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptimeSeconds: roundLatency(process.uptime() * 1000) / 1000
  };
}

export async function createReadinessReport(service: string, checks: HealthCheckDefinition[]): Promise<ReadinessReport> {
  const results = await Promise.all(checks.map(async (check) => executeHealthCheck(check)));
  const criticalDown = results.filter((result) => result.critical && result.status === 'down').length;
  const down = results.filter((result) => result.status === 'down').length;
  const up = results.length - down;

  return {
    checks: results,
    mode: 'ready',
    ready: criticalDown === 0,
    service,
    status: criticalDown > 0 ? 'error' : down > 0 ? 'degraded' : 'ok',
    summary: {
      total: results.length,
      up,
      down,
      criticalDown
    },
    timestamp: new Date().toISOString(),
    uptimeSeconds: roundLatency(process.uptime() * 1000) / 1000
  };
}

export function createPrismaHealthCheck(
  name: string,
  prisma: PrismaClientLike,
  options?: Pick<HealthCheckDefinition, 'critical' | 'timeoutMs'>
): HealthCheckDefinition {
  return {
    name,
    type: 'database',
    critical: options?.critical,
    timeoutMs: options?.timeoutMs,
    check: async () => {
      await prisma.$queryRawUnsafe('SELECT 1');
      return {
        query: 'SELECT 1'
      };
    }
  };
}

export function createHttpHealthCheck(name: string, baseUrl: string, options?: HttpHealthCheckOptions): HealthCheckDefinition {
  return {
    name,
    type: 'http',
    critical: options?.critical,
    timeoutMs: options?.timeoutMs,
    check: async () => {
      const targetUrl = new URL(options?.path ?? '/health', ensureTrailingSlash(baseUrl));
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), options?.timeoutMs ?? 3_000);

      try {
        const response = await fetch(targetUrl, {
          headers: {
            Accept: 'application/json'
          },
          signal: controller.signal
        });
        const body = await parseJsonBody(response);

        if (!response.ok) {
          throw new Error(`Unexpected HTTP ${response.status} from ${targetUrl.toString()}`);
        }

        return {
          httpStatus: response.status,
          upstreamReady: typeof body?.ready === 'boolean' ? body.ready : undefined,
          upstreamService: typeof body?.service === 'string' ? body.service : undefined,
          upstreamStatus: typeof body?.status === 'string' ? body.status : undefined,
          url: targetUrl.toString()
        };
      } finally {
        clearTimeout(timeout);
      }
    }
  };
}

async function executeHealthCheck(check: HealthCheckDefinition): Promise<HealthCheckResult> {
  const startedAt = performance.now();

  try {
    const details = await withTimeout(check.check(), check.timeoutMs ?? 3_000);
    return {
      critical: check.critical ?? true,
      details: hasValues(details) ? details : undefined,
      latencyMs: roundLatency(performance.now() - startedAt),
      name: check.name,
      status: 'up',
      type: check.type
    };
  } catch (error) {
    return {
      critical: check.critical ?? true,
      error: formatError(error),
      latencyMs: roundLatency(performance.now() - startedAt),
      name: check.name,
      status: 'down',
      type: check.type
    };
  }
}

async function withTimeout<TValue>(promise: Promise<TValue>, timeoutMs: number): Promise<TValue> {
  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error(`Health check timed out after ${timeoutMs}ms`)), timeoutMs);
      })
    ]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function parseJsonBody(response: Response): Promise<Record<string, unknown> | undefined> {
  const contentType = response.headers.get('content-type');

  if (!contentType?.includes('application/json')) {
    return undefined;
  }

  const body = (await response.json()) as unknown;
  return isRecord(body) ? body : undefined;
}

function ensureTrailingSlash(value: string) {
  return value.endsWith('/') ? value : `${value}/`;
}

function hasValues(value: Record<string, unknown> | void): value is Record<string, unknown> {
  if (!value) {
    return false;
  }

  return Object.values(value).some((entry) => entry !== undefined);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === 'string') {
    return error;
  }

  try {
    return JSON.stringify(error);
  } catch {
    return 'Unknown health check error';
  }
}

function roundLatency(value: number) {
  return Math.round(value * 100) / 100;
}
