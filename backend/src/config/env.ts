import dotenv from "dotenv";
import { z } from "zod";

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_ACCESS_EXPIRES_IN: z.string().default("15m"),
  JWT_REFRESH_SECRET: z.string().min(16),
  JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
  CLIENT_ORIGIN: z.string().default("http://localhost:3000"),
  CLIENT_ORIGINS: z.string().optional(),
  CLIENT_ORIGIN_REGEX: z.string().optional(),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  SMTP_HOST: z.string().default("localhost"),
  SMTP_PORT: z.coerce.number().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional()
});

export const env = envSchema.parse(process.env);

function parseOrigins(raw: string | undefined): string[] {
  if (!raw) {
    return [];
  }

  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
}

const dynamicOriginRegex = env.CLIENT_ORIGIN_REGEX
  ? new RegExp(env.CLIENT_ORIGIN_REGEX)
  : null;

const staticOrigins = new Set<string>([
  env.CLIENT_ORIGIN,
  ...parseOrigins(env.CLIENT_ORIGINS)
]);

export function isAllowedOrigin(origin: string | undefined): boolean {
  // Non-browser and same-origin requests may not send an Origin header.
  if (!origin) {
    return true;
  }

  if (staticOrigins.has(origin)) {
    return true;
  }

  return dynamicOriginRegex ? dynamicOriginRegex.test(origin) : false;
}
