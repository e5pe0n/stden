-- CreateEnum
CREATE TYPE "ask_type" AS ENUM ('meaning', 'diff', 'free');

-- CreateTable
CREATE TABLE "histories" (
    "id" SERIAL NOT NULL,
    "type" "ask_type" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "histories_created_at_idx" ON "histories"("created_at");
