import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "../generated/prisma/index.js";
import { config } from "./config.js";
import type { Candidate, GradedUse } from "./schedule.js";

const adapter = new PrismaPg({
  connectionString: config.databaseUrl,
});

const prisma = new PrismaClient({
  adapter,
});

export function insertMeaning(data: Prisma.meaningsCreateInput) {
  return prisma.meanings.create({
    data,
  });
}

export function updateMeaning(
  data: Prisma.meaningsUpdateInput,
  where: Prisma.meaningsWhereUniqueInput,
) {
  return prisma.meanings.update({
    data,
    where,
  });
}

export function findMeaning(where: Prisma.meaningsWhereUniqueInput) {
  return prisma.meanings.findUnique({
    where,
  });
}

export function insertHistory(data: Prisma.historiesCreateInput) {
  return prisma.histories.create({
    data,
  });
}

export function listHistories({ take }: { take: number }) {
  return prisma.histories.findMany({
    orderBy: { created_at: "desc" },
    take,
  });
}

export function findHistory(where: Prisma.historiesWhereUniqueInput) {
  return prisma.histories.findUnique({
    where,
  });
}

/**
 * `deleteMany` rather than `delete` so a missing row reports `count: 0`
 * instead of throwing, letting the route answer 404 without a try/catch.
 */
export function deleteHistory(where: Prisma.historiesWhereInput) {
  return prisma.histories.deleteMany({
    where,
  });
}

/** Every word a test can ask, with what untested ones are ordered by. */
export async function listWordCandidates(): Promise<Candidate[]> {
  const rows = await prisma.meanings.findMany({
    select: { word: true, asked_count: true, created_at: true },
  });
  return rows.map((row) => ({
    word: row.word,
    askedCount: row.asked_count,
    createdAt: row.created_at,
  }));
}

/**
 * Every graded answer, for word selection to replay. The whole history is read
 * per test, which is the right trade for a personal dictionary: ten rows a test
 * stays small, and nothing derived is stored to fall out of step. Ungraded
 * answers are left out — they say nothing about the learner.
 */
export async function listGradedUses(): Promise<GradedUse[]> {
  const rows = await prisma.test_questions.findMany({
    where: { correct: { not: null } },
    select: {
      word: true,
      correct: true,
      test: { select: { created_at: true } },
    },
  });
  return rows.map((row) => ({
    word: row.word,
    correct: row.correct === true,
    at: row.test.created_at,
  }));
}

export function insertTest(data: Prisma.testsCreateInput) {
  return prisma.tests.create({
    data,
    include: { questions: { orderBy: { position: "asc" } } },
  });
}

/** Only the words and their verdicts come back: the sidebar labels a test with
 *  them and counts the right ones, and the answers and comments are bodies no
 *  list needs. */
export function listTests({ take }: { take: number }) {
  return prisma.tests.findMany({
    orderBy: { created_at: "desc" },
    take,
    include: {
      questions: {
        orderBy: { position: "asc" },
        select: { word: true, correct: true },
      },
    },
  });
}

export function findTest(where: Prisma.testsWhereUniqueInput) {
  return prisma.tests.findUnique({
    where,
    include: { questions: { orderBy: { position: "asc" } } },
  });
}

/** `deleteMany` for the same reason as `deleteHistory`: 0 rows, not a throw. */
export function deleteTest(where: Prisma.testsWhereInput) {
  return prisma.tests.deleteMany({
    where,
  });
}
