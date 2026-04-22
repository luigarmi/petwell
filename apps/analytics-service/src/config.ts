import { commonEnvSchema, databaseEnvSchema, loadEnv, mergeSchemas } from '@petwell/shared-config';

type BaseEnv = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  SERVICE_NAME: string;
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  JWT_ACCESS_TTL: string;
  JWT_REFRESH_TTL: string;
  RABBITMQ_URL: string;
  REDIS_URL: string;
  LOG_FILE_PATH?: string;
  CORS_ORIGIN: string;
  DATABASE_URL: string;
};

const baseEnv = loadEnv(mergeSchemas(commonEnvSchema, databaseEnvSchema), process.env) as BaseEnv;

for (const key of ['BILLING_SERVICE_URL', 'APPOINTMENT_SERVICE_URL', 'PET_SERVICE_URL'] as const) {
  if (!process.env[key]) {
    throw new Error(`${key} is required`);
  }
}

export const env = {
  ...baseEnv,
  BILLING_SERVICE_URL: process.env.BILLING_SERVICE_URL!,
  APPOINTMENT_SERVICE_URL: process.env.APPOINTMENT_SERVICE_URL!,
  PET_SERVICE_URL: process.env.PET_SERVICE_URL!
};
