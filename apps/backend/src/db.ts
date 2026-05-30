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
