import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1),
  DIRECT_DATABASE_URL: z.string().optional(),
  REDIS_URL: z.string().optional(),

  LLM_PROVIDER: z.enum(["ollama", "openai", "mock"]).default("ollama"),
  OLLAMA_BASE_URL: z.string().default("http://host.docker.internal:11434"),
  OLLAMA_MODEL: z.string().default("qwen2.5:7b-instruct"),

  OPENAI_API_KEY: z.string().optional().default(""),
  OPENAI_MODEL: z.string().default("qwen2.5:7b"),
  OPENAI_BASE_URL: z.string().optional().default("http://host.docker.internal:11434/v1"),

  APP_TIMEZONE: z.string().default("America/Sao_Paulo"),
  APP_UTC_OFFSET_MINUTES: z.coerce.number().int().default(-180),

  DEFAULT_HOLD_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  SCHEDULING_HOLD_TTL_MINUTES: z.coerce.number().int().positive().default(10),
  SCHEDULING_SLOT_STEP_MINUTES: z.coerce.number().int().positive().default(30),
  WORKING_HOUR_START: z.coerce.number().int().min(0).max(23).default(8),
  WORKING_HOUR_END: z.coerce.number().int().min(1).max(24).default(19),

  MESSAGE_CONTEXT_LIMIT: z.coerce.number().int().positive().default(20),
  LOG_LEVEL: z.enum(["debug", "info", "warn", "error"]).default("info"),

  DEFAULT_CLINIC_ID: z.string().default("00000000-0000-0000-0000-000000000001"),

  // Google Calendar integration (optional — features degrade gracefully)
  GOOGLE_CLIENT_ID: z.string().optional().default(""),
  GOOGLE_CLIENT_SECRET: z.string().optional().default(""),
  GOOGLE_WEBHOOK_BASE_URL: z.string().optional().default(""),
});

export type Env = z.infer<typeof envSchema>;

let cachedEnv: Env | null = null;

export function getEnv(): Env {
  if (cachedEnv) {
    return cachedEnv;
  }

  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    throw new Error(`Invalid environment variables: ${parsed.error.message}`);
  }

  cachedEnv = parsed.data;
  return cachedEnv;
}
