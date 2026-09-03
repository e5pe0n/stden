import { z } from "zod";

const envSchema = z.object({
  /**
   * Same-origin by default. In production the API server also serves this
   * bundle, so a relative path needs no build-time configuration — which is
   * important because `.dockerignore` excludes `.env*` from the image build.
   */
  VITE_BACKEND_API_ENDPOINT: z.string().default("/api/v1"),
  /**
   * Vite exposes env values as strings, so this cannot be `z.boolean()` —
   * that would reject the string "true" and throw at startup.
   */
  VITE_MSW_ENABLED: z
    .string()
    .optional()
    .transform((v) => v === "true"),
});

const env = envSchema.safeParse(import.meta.env);
if (!env.success) {
  console.error("Invalid environment variables:", env.error.format());
  throw new Error("Invalid environment variables");
}

export const config: {
  backendApiEndpoint: string;
  mswEnabled: boolean;
} = {
  backendApiEndpoint: env.data.VITE_BACKEND_API_ENDPOINT,
  mswEnabled: env.data.VITE_MSW_ENABLED,
};
