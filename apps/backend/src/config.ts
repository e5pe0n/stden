import { z } from "zod";

const envSchema = z.object({
  GOOGLE_GEN_AI_API_KEY: z.string(),
  DATABASE_URL: z.string(),
  PORT: z.coerce.number().int().positive().default(3000),
  /**
   * Comma-separated list of allowed CORS origins.
   * Empty disables CORS, which is what production wants: the SPA is served
   * from the same origin as the API, so no cross-origin requests happen.
   */
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  /** Directory holding the built SPA. Unset in dev, where Vite serves it. */
  STATIC_DIR: z.string().optional(),
});

const env = envSchema.safeParse(process.env);
if (!env.success) {
  console.error("Invalid environment variables:", env.error.format());
  throw new Error("Invalid environment variables");
}

export const config: {
  googleGenAiApiKey: string;
  databaseUrl: string;
  port: number;
  corsOrigins: string[];
  staticDir: string | undefined;
} = {
  googleGenAiApiKey: env.data.GOOGLE_GEN_AI_API_KEY,
  databaseUrl: env.data.DATABASE_URL,
  port: env.data.PORT,
  corsOrigins: env.data.CORS_ORIGIN.split(",")
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0),
  staticDir: env.data.STATIC_DIR,
};
