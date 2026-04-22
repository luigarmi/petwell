import { z } from 'zod';

export const commonEnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive(),
  SERVICE_NAME: z.string().min(1),
  APP_URL: z.string().url().optional(),
  API_GATEWAY_URL: z.string().url().optional(),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_ACCESS_TTL: z.string().default('15m'),
  JWT_REFRESH_TTL: z.string().default('7d'),
  RABBITMQ_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  LOG_FILE_PATH: z.string().min(1).optional(),
  CORS_ORIGIN: z.string().default('*')
});

export const databaseEnvSchema = z.object({
  DATABASE_URL: z.string().min(1)
});

export const smtpEnvSchema = z.object({
  MAIL_HOST: z.string().min(1),
  MAIL_PORT: z.coerce.number().int().positive(),
  MAIL_USER: z.string().optional(),
  MAIL_PASS: z.string().optional(),
  MAIL_FROM: z.string().email()
});

export const storageEnvSchema = z.object({
  MINIO_ENDPOINT: z.string().min(1),
  MINIO_PORT: z.coerce.number().int().positive(),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),
  MINIO_BUCKET: z.string().min(1),
  MINIO_USE_SSL: z
    .union([z.boolean(), z.string()])
    .transform((value) => value === true || value === 'true')
    .default(false)
});

export const paymentEnvSchema = z.object({
  PAYMENT_PROVIDER: z.enum(['mock', 'wompi', 'mercadopago']).default('mock'),
  PAYMENT_CURRENCY: z.string().default('COP'),
  PUBLIC_APP_URL: z.string().url(),
  API_PUBLIC_URL: z.string().url(),
  WOMPI_SANDBOX_PUBLIC_KEY: z.string().optional(),
  WOMPI_SANDBOX_PRIVATE_KEY: z.string().optional(),
  WOMPI_SANDBOX_EVENTS_SECRET: z.string().optional(),
  WOMPI_PRODUCTION_PUBLIC_KEY: z.string().optional(),
  WOMPI_PRODUCTION_PRIVATE_KEY: z.string().optional(),
  WOMPI_PRODUCTION_EVENTS_SECRET: z.string().optional(),
  MERCADOPAGO_SANDBOX_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_SANDBOX_WEBHOOK_SECRET: z.string().optional(),
  MERCADOPAGO_PRODUCTION_ACCESS_TOKEN: z.string().optional(),
  MERCADOPAGO_PRODUCTION_WEBHOOK_SECRET: z.string().optional()
});

export const telemedEnvSchema = z.object({
  TELEMED_PROVIDER: z.enum(['mock', 'twilio', 'daily']).default('mock'),
  PUBLIC_APP_URL: z.string().url(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_API_KEY: z.string().optional(),
  TWILIO_API_SECRET: z.string().optional(),
  DAILY_API_KEY: z.string().optional()
});

export function loadEnv<T extends z.ZodTypeAny>(schema: T, env: NodeJS.ProcessEnv = process.env): z.infer<T> {
  return schema.parse(env);
}

export function mergeSchemas<T extends z.AnyZodObject[]>(...schemas: T) {
  return schemas.reduce((accumulator, schema) => accumulator.merge(schema));
}
