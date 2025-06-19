import { z } from "zod";

const envSchema = z.object({
  GOOGLE_GEN_AI_API_KEY: z.string(),
  DATABASE_URL: z.string(),
  PORT: z.coerce.number(),
});

const res = envSchema.safeParse(process.env);
if (!res.success) {
  console.error("Invalid environment variables:", res.error.format());
  throw new Error("Invalid environment variables");
}

export const appConfig: {
  googleGenAiApiKey: string;
  databaseUrl: string;
  port: number;
} = {
  googleGenAiApiKey: res.data.GOOGLE_GEN_AI_API_KEY,
  databaseUrl: res.data.DATABASE_URL,
  port: res.data.PORT,
};
