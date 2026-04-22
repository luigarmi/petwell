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

const required = [
  'PAYMENT_PROVIDER',
  'PAYMENT_CURRENCY',
  'PUBLIC_APP_URL',
  'API_PUBLIC_URL',
  'MINIO_ENDPOINT',
  'MINIO_PORT',
  'MINIO_ACCESS_KEY',
  'MINIO_SECRET_KEY',
  'MINIO_BUCKET'
] as const;

for (const key of required) {
  if (!process.env[key]) {
    throw new Error(`${key} is required`);
  }
}

export const env = {
  ...baseEnv,
  PAYMENT_PROVIDER: process.env.PAYMENT_PROVIDER as 'mock' | 'wompi' | 'mercadopago',
  PAYMENT_CURRENCY: process.env.PAYMENT_CURRENCY as 'COP',
  PUBLIC_APP_URL: process.env.PUBLIC_APP_URL!,
  API_PUBLIC_URL: process.env.API_PUBLIC_URL!,
  MINIO_ENDPOINT: process.env.MINIO_ENDPOINT!,
  MINIO_PORT: Number(process.env.MINIO_PORT),
  MINIO_ACCESS_KEY: process.env.MINIO_ACCESS_KEY!,
  MINIO_SECRET_KEY: process.env.MINIO_SECRET_KEY!,
  MINIO_BUCKET: process.env.MINIO_BUCKET!,
  MINIO_USE_SSL: process.env.MINIO_USE_SSL === 'true',
  WOMPI_SANDBOX_PUBLIC_KEY: process.env.WOMPI_SANDBOX_PUBLIC_KEY,
  WOMPI_SANDBOX_PRIVATE_KEY: process.env.WOMPI_SANDBOX_PRIVATE_KEY,
  WOMPI_SANDBOX_INTEGRITY_SECRET: process.env.WOMPI_SANDBOX_INTEGRITY_SECRET,
  WOMPI_SANDBOX_EVENTS_SECRET: process.env.WOMPI_SANDBOX_EVENTS_SECRET,
  WOMPI_PRODUCTION_PUBLIC_KEY: process.env.WOMPI_PRODUCTION_PUBLIC_KEY,
  WOMPI_PRODUCTION_PRIVATE_KEY: process.env.WOMPI_PRODUCTION_PRIVATE_KEY,
  WOMPI_PRODUCTION_INTEGRITY_SECRET: process.env.WOMPI_PRODUCTION_INTEGRITY_SECRET,
  WOMPI_PRODUCTION_EVENTS_SECRET: process.env.WOMPI_PRODUCTION_EVENTS_SECRET,
  MERCADOPAGO_SANDBOX_ACCESS_TOKEN: process.env.MERCADOPAGO_SANDBOX_ACCESS_TOKEN,
  MERCADOPAGO_SANDBOX_WEBHOOK_SECRET: process.env.MERCADOPAGO_SANDBOX_WEBHOOK_SECRET,
  MERCADOPAGO_PRODUCTION_ACCESS_TOKEN: process.env.MERCADOPAGO_PRODUCTION_ACCESS_TOKEN,
  MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET: process.env.MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET
};
