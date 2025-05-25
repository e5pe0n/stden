import { type Prisma, PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

export function insertMeaning(data: Prisma.MeaningCreateInput) {
	return prisma.meaning.create({
		data,
	});
}

export function updateMeaning(
	data: Prisma.MeaningUpdateInput,
	where: Prisma.MeaningWhereUniqueInput,
) {
	return prisma.meaning.update({
		data,
		where,
	});
}

export function findMeaning(where: Prisma.MeaningWhereUniqueInput) {
	return prisma.meaning.findUnique({
		where,
	});
}
