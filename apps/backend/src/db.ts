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
