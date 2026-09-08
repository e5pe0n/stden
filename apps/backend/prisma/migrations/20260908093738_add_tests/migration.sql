-- CreateTable
CREATE TABLE "tests" (
    "id" SERIAL NOT NULL,
    "score" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "test_questions" (
    "id" SERIAL NOT NULL,
    "test_id" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "word" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "correct" BOOLEAN NOT NULL,
    "comment" TEXT NOT NULL,

    CONSTRAINT "test_questions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tests_created_at_idx" ON "tests"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "test_questions_test_id_position_key" ON "test_questions"("test_id", "position");

-- AddForeignKey
ALTER TABLE "test_questions" ADD CONSTRAINT "test_questions_test_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
