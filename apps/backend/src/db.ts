import { PrismaPg } from "@prisma/adapter-pg";
import { type Prisma, PrismaClient } from "../generated/prisma/index.js";
import { config } from "./config.js";

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

/**
 * A random sample of words already looked up. `ORDER BY random()` sorts the
 * whole table, which is the right trade for a personal dictionary: it is
 * exact, needs no id bookkeeping, and the row count stays in the thousands.
 */
export async function pickRandomWords({
  take,
}: {
  take: number;
}): Promise<string[]> {
  const rows = await prisma.$queryRaw<
    { word: string }[]
  >`SELECT word FROM meanings ORDER BY random() LIMIT ${take}`;
  return rows.map((row) => row.word);
}

export function countMeanings() {
  return prisma.meanings.count();
}

export function insertTest(data: Prisma.testsCreateInput) {
  return prisma.tests.create({
    data,
    include: { questions: { orderBy: { position: "asc" } } },
  });
}

/** Only the words come back: the sidebar labels a test with them, and the
 *  answers and comments are bodies no list needs. */
export function listTests({ take }: { take: number }) {
  return prisma.tests.findMany({
    orderBy: { created_at: "desc" },
    take,
    include: {
      questions: { orderBy: { position: "asc" }, select: { word: true } },
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
