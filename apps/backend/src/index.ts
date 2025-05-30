import "dotenv/config";
import cors from "@fastify/cors";
import Fastify from "fastify";
import { handleMeaning } from "./meaning.js";
import { ask } from "./genai.js";

const PORT = process.env.PORT || 3000;

// Initialize Fastify server
const fastify = Fastify({
  logger: true,
});

// Register CORS plugin
await fastify.register(cors, {
  origin: true, // Allow all origins
});

// Implement POST endpoint at /api/v1
fastify.post("/api/v1", async (request, reply) => {
  const { text } = request.body as { text: string };

  if (!text) {
    return reply.code(400).send({ error: "Missing required field: text" });
  }

  const res = await handleMeaning({
    word: text,
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

// Start the server
const start = async () => {
  try {
    await fastify.listen({ port: Number(PORT), host: "0.0.0.0" });
    console.log(`Server listening on ${PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
