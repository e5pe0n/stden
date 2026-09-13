import "dotenv/config";
import { resolve } from "node:path";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import Fastify from "fastify";
import { z } from "zod";
import { config } from "./config.js";
import {
  deleteHistory,
  deleteTest,
  findHistory,
  findTest,
  insertHistory,
  insertTest,
  listGradedUses,
  listHistories,
  listTests,
  listWordCandidates,
} from "./db.js";
import { ask, askJson } from "./genai.js";
import {
  HISTORY_LIST_LIMIT,
  toHistoryEntry,
  toHistorySummary,
  toQuestionText,
} from "./history.js";
import { handleAskByType } from "./meaning.js";
import { pickTestWords } from "./schedule.js";
import {
  gradeAnswers,
  TEST_LIST_LIMIT,
  toTestEntry,
  toTestSummary,
} from "./test.js";
import { type HistorySummary, TEST_WORD_COUNT } from "./types.js";

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

const historyParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const testParamsSchema = historyParamsSchema;

const submitTestSchema = z.object({
  answers: z
    .array(
      z.object({
        word: z.string().min(1),
        answer: z.string(),
      }),
    )
    .length(TEST_WORD_COUNT),
});

// Initialize Fastify server
const fastify = Fastify({
  logger: true,
});

// Register CORS plugin.
// In production the SPA is served from this same origin, so there are no
// cross-origin requests and CORS stays off.
await fastify.register(cors, {
  origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
  // The default omits DELETE, which the history routes need. Only dev sees
  // this: production serves the SPA from this origin and disables CORS.
  methods: ["GET", "POST", "DELETE"],
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

  // History is a record of the ask, not part of answering it: a failed write
  // costs the sidebar one row and must not turn a good answer into a 500.
  let history: HistorySummary | undefined;
  try {
    history = toHistorySummary(
      await insertHistory({
        type: parsed.data.type,
        question: toQuestionText(parsed.data),
        answer: res.value,
      }),
    );
  } catch (error) {
    request.log.error(error, "failed to record history");
  }

  return reply.send({
    text: res.value,
    history,
  });
});

// Most recent asks, newest first. Answers are omitted — the sidebar only needs
// labels, and the bodies are markdown documents.
fastify.get("/api/v1/histories", async (_request, reply) => {
  const rows = await listHistories({ take: HISTORY_LIST_LIMIT });
  return reply.send({ histories: rows.map(toHistorySummary) });
});

// One entry with its answer, loaded when the sidebar opens it.
fastify.get("/api/v1/histories/:id", async (request, reply) => {
  const parsed = historyParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid history id" });
  }

  const row = await findHistory({ id: parsed.data.id });
  if (!row) {
    return reply.code(404).send({ error: "Not found" });
  }

  return reply.send({ history: toHistoryEntry(row) });
});

fastify.delete("/api/v1/histories/:id", async (request, reply) => {
  const parsed = historyParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid history id" });
  }

  const { count } = await deleteHistory({ id: parsed.data.id });
  if (count === 0) {
    return reply.code(404).send({ error: "Not found" });
  }

  return reply.code(204).send();
});

// A fresh test set: the `TEST_WORD_COUNT` looked-up words most in need of
// practice, as `pickTestWords` ranks them. Nothing is written yet — a test
// reaches the database only once it has been answered, so abandoning one
// leaves no trace.
fastify.get("/api/v1/tests/new", async (_request, reply) => {
  const [candidates, uses] = await Promise.all([
    listWordCandidates(),
    listGradedUses(),
  ]);
  const words = pickTestWords({ candidates, uses, take: TEST_WORD_COUNT });

  if (words.length < TEST_WORD_COUNT) {
    return reply.code(409).send({
      error: "Not enough words yet",
      available: candidates.length,
      required: TEST_WORD_COUNT,
    });
  }

  return reply.send({ words });
});

// Grade a finished test and store it. Grading is the whole point of the
// request, so unlike the ask route this one fails loudly when it cannot run.
fastify.post("/api/v1/tests", async (request, reply) => {
  const parsed = submitTestSchema.safeParse(request.body);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid request body" });
  }

  const { answers } = parsed.data;

  const graded = await gradeAnswers({ answers, askJson });
  if (!graded.success) {
    request.log.error(graded.error);
    return reply.code(500).send({ error: "Couldn't grade this test" });
  }

  const row = await insertTest({
    questions: { create: graded.value },
  });

  return reply.send({ test: toTestEntry(row) });
});

// Past tests, newest first — words and score only, like the history list.
fastify.get("/api/v1/tests", async (_request, reply) => {
  const rows = await listTests({ take: TEST_LIST_LIMIT });
  return reply.send({ tests: rows.map(toTestSummary) });
});

fastify.get("/api/v1/tests/:id", async (request, reply) => {
  const parsed = testParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid test id" });
  }

  const row = await findTest({ id: parsed.data.id });
  if (!row) {
    return reply.code(404).send({ error: "Not found" });
  }

  return reply.send({ test: toTestEntry(row) });
});

fastify.delete("/api/v1/tests/:id", async (request, reply) => {
  const parsed = testParamsSchema.safeParse(request.params);
  if (!parsed.success) {
    return reply.code(400).send({ error: "Invalid test id" });
  }

  const { count } = await deleteTest({ id: parsed.data.id });
  if (count === 0) {
    return reply.code(404).send({ error: "Not found" });
  }

  return reply.code(204).send();
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
