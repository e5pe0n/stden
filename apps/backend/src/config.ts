import { z } from "zod";

const envSchema = z.object({
  GOOGLE_GEN_AI_API_KEY: z.string(),
  DATABASE_URL: z.string(),
});

const env = envSchema.safeParse(process.env);
if (!env.success) {
  console.error("Invalid environment variables:", env.error.format());
  throw new Error("Invalid environment variables");
}

export const config: {
  googleGenAiApiKey: string;
  databaseUrl: string;
} = {
  googleGenAiApiKey: env.data.GOOGLE_GEN_AI_API_KEY,
  databaseUrl: env.data.DATABASE_URL,
};
