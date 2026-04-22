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

if (!process.env.FIELD_ENCRYPTION_KEY) {
  throw new Error('FIELD_ENCRYPTION_KEY is required');
}

if (!process.env.PET_SERVICE_URL) {
  throw new Error('PET_SERVICE_URL is required');
}

export const env = {
  ...baseEnv,
  FIELD_ENCRYPTION_KEY: process.env.FIELD_ENCRYPTION_KEY,
  PET_SERVICE_URL: process.env.PET_SERVICE_URL,
  EHR_STORAGE_PATH: process.env.EHR_STORAGE_PATH
};
