import { z } from "zod";

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_BASE_URL: z.url().default("http://localhost:3000"),
  APP_TIMEZONE: z.string().default("America/Guayaquil"),
  DATABASE_URL: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32),
  QR_SIGNING_SECRET: z.string().min(32),
  PRIVATE_UPLOAD_DIR: z.string().default("./var/uploads"),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().max(25 * 1024 * 1024).default(10 * 1024 * 1024),
  AI_VISION_PROVIDER: z.enum(["disabled", "openai-compatible"]).default("disabled"),
  AI_VISION_BASE_URL: z.url().default("https://api.openai.com/v1"),
  AI_VISION_MODEL: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  CRON_SECRET: z.string().min(16),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;

let cached: ServerEnv | undefined;

export function getServerEnv(): ServerEnv {
  if (!cached) {
    const parsed = serverEnvSchema.safeParse(process.env);
    if (!parsed.success) {
      const fields = Object.keys(parsed.error.flatten().fieldErrors).join(", ");
      throw new Error(`Configuración de servidor inválida o incompleta: ${fields}`);
    }
    cached = parsed.data;
  }
  return cached;
}

export function resetEnvForTests() {
  cached = undefined;
}
