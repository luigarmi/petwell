import dotenv from "dotenv";

dotenv.config();

const serviceDatabaseNames = {
  USER: "petwell_user",
  PET: "petwell_pet",
  EHR: "petwell_ehr",
  APPOINTMENT: "petwell_appointment",
  BILLING: "petwell_billing",
  TELEMED: "petwell_telemed",
  NOTIFICATION: "petwell_notification",
  ANALYTICS: "petwell_analytics"
} as const;

export type ServiceDatabaseKey = keyof typeof serviceDatabaseNames;

export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function getEnv(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export function getNumberEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) {
    return fallback;
  }
  const parsed = Number(value);
  return Number.isNaN(parsed) ? fallback : parsed;
}

export function normalizePem(value: string): string {
  return value.replace(/\\n/g, "\n").replace(/\s+BEGIN/g, "\nBEGIN").trim();
}

export function requireServiceDbUrl(service: ServiceDatabaseKey): string {
  const specificName = `${service}_DB_URL`;
  const specificValue = process.env[specificName]?.trim();
  if (specificValue) {
    return specificValue;
  }

  const baseUrl =
    process.env.PETWELL_POSTGRES_BASE_URL?.trim() ||
    process.env.POSTGRES_URL?.trim() ||
    process.env.DATABASE_URL?.trim();

  if (!baseUrl) {
    throw new Error(
      `Missing required environment variable: ${specificName} or PETWELL_POSTGRES_BASE_URL`
    );
  }

  const url = new URL(baseUrl);
  url.pathname = `/${serviceDatabaseNames[service]}`;
  return url.toString();
}

export function getAllowedOrigins(): string[] {
  return requireEnv("CORS_ALLOWED_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
