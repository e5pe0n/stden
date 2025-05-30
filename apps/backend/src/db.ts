import { type Prisma, PrismaClient } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

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
