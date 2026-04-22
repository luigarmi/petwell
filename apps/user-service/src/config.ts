import { commonEnvSchema, databaseEnvSchema, loadEnv, mergeSchemas } from '@petwell/shared-config';

type BaseEnv = {
  NODE_ENV: 'development' | 'test' | 'production';
  PORT: number;
  SERVICE_NAME: string;
  APP_URL?: string;
  API_GATEWAY_URL?: string;
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

if (!process.env.PUBLIC_APP_URL) {
  throw new Error('PUBLIC_APP_URL is required');
}

if (!process.env.MAIL_FROM) {
  throw new Error('MAIL_FROM is required');
}

export const env = {
  ...baseEnv,
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL,
  MAIL_FROM: process.env.MAIL_FROM
};
