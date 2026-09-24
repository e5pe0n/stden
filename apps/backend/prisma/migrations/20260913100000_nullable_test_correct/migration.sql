-- An item the grader returned no verdict for used to be stored as wrong. That
-- is harmless for one test's count, but word selection now replays these rows,
-- and a false "wrong" would reset a word the learner actually knows. Null
-- records "not graded" instead.
ALTER TABLE "test_questions" ALTER COLUMN "correct" DROP NOT NULL;

-- Rows saved before this carry a false verdict under the fallback comment,
-- which is only ever written for an item that got no grade.
UPDATE "test_questions" SET "correct" = NULL
WHERE "comment" = 'This answer could not be graded.';
