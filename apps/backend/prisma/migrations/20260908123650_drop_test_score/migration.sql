-- The score was the number of correct answers times ten, so it duplicated
-- what `test_questions.correct` already records. Dropping it loses nothing
-- that cannot be counted back from those rows.
ALTER TABLE "tests" DROP COLUMN "score";
