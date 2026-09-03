import "dotenv/config";
import { resolve } from "node:path";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import { ask } from "./genai.js";
import { handleAskByType } from "./meaning.js";

const askSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("meaning"),
    input: z.string().min(1),
    regenerate: z.boolean().optional(),
  }),
  z.object({
    type: z.literal("diff"),
    input: z.array(z.string().min(1)).min(2),
  }),
  z.object({
    type: z.literal("free"),
    input: z.string().min(1),
  }),
]);

// Initialize Fastify server
const fastify = Fastify({
  logger: true,
});

// Register CORS plugin.
// In production the SPA is served from this same origin, so there are no
// cross-origin requests and CORS stays off.
await fastify.register(cors, {
  origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
});

// Liveness probe. Deploys poll this to confirm a rollout succeeded.
fastify.get("/api/health", async () => ({ status: "ok" }));

// Implement POST endpoint at /api/v1
fastify.post("/api/v1", async (request, reply) => {
  const parsed = askSchema.safeParse(request.body);

  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid request body" });
  }

  const res = await handleAskByType({
    payload: parsed.data,
    ask,
  });

  if (!res.success) {
    request.log.error(res.error);
    return reply.code(500).send({ error: "Internal server error" });
  }

  return reply.send({
    text: res.value,
  });
});

// Serve the built SPA from the same origin as the API. Only in production —
// in dev, Vite serves the frontend on its own port.
if (config.staticDir) {
  // @fastify/static requires an absolute root.
  await fastify.register(fastifyStatic, { root: resolve(config.staticDir) });

  // SPA fallback: anything that isn't an API route or a real file resolves to
  // index.html so client-side routing works on a hard refresh.
  fastify.setNotFoundHandler((request, reply) => {
    if (request.url.startsWith("/api/")) {
      return reply.code(404).send({ error: "Not found" });
    }
    return reply.sendFile("index.html");
  });
}

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: config.port, host: "0.0.0.0" });
    console.log(`Server listening on ${config.port}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
