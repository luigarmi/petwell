import { commonEnvSchema, loadEnv } from '@petwell/shared-config';

type GatewayEnv = {
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
};

const baseEnv = loadEnv(commonEnvSchema, process.env) as GatewayEnv;

for (const key of [
  'USER_SERVICE_URL',
  'PET_SERVICE_URL',
  'EHR_SERVICE_URL',
  'APPOINTMENT_SERVICE_URL',
  'TELEMED_SERVICE_URL',
  'NOTIFICATION_SERVICE_URL',
  'BILLING_SERVICE_URL',
  'ANALYTICS_SERVICE_URL'
] as const) {
  if (!process.env[key]) {
    throw new Error(`${key} is required`);
  }
}

export const env = {
  ...baseEnv,
  USER_SERVICE_URL: process.env.USER_SERVICE_URL!,
  PET_SERVICE_URL: process.env.PET_SERVICE_URL!,
  EHR_SERVICE_URL: process.env.EHR_SERVICE_URL!,
  APPOINTMENT_SERVICE_URL: process.env.APPOINTMENT_SERVICE_URL!,
  TELEMED_SERVICE_URL: process.env.TELEMED_SERVICE_URL!,
  NOTIFICATION_SERVICE_URL: process.env.NOTIFICATION_SERVICE_URL!,
  BILLING_SERVICE_URL: process.env.BILLING_SERVICE_URL!,
  ANALYTICS_SERVICE_URL: process.env.ANALYTICS_SERVICE_URL!
};
