import { z } from "zod";

const envSchema = z.object({
  VITE_BACKEND_API_ENDPOINT: z.string(),
  VITE_MSW_ENABLED: z.boolean().optional(),
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
  mswEnabled: env.data.VITE_MSW_ENABLED ?? false,
};
