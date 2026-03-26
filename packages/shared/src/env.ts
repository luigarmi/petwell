import dotenv from "dotenv";

dotenv.config();

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

export function getAllowedOrigins(): string[] {
  return requireEnv("CORS_ALLOWED_ORIGINS")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}
