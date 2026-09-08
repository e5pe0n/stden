import { z } from "zod";
import type { test_questions, tests } from "../generated/prisma/index.js";
import type { Result, TestEntry, TestQuestion, TestSummary } from "./types.js";

/**
 * How many past tests the sidebar lists. Matches the history limit: the two
 * lists share the sidebar and neither should scroll further than the other.
 */
export const TEST_LIST_LIMIT = 200;

/** One word and what the learner wrote for it, before grading. */
export type SubmittedAnswer = {
  word: string;
  answer: string;
};

const gradesSchema = z.object({
  grades: z.array(
    z.object({
      position: z.number().int(),
      correct: z.boolean(),
      comment: z.string(),
    }),
  ),
});

export function buildGradingPrompt(answers: SubmittedAnswer[]): string {
  const items = answers
    .map(
      (item, index) =>
        `${index + 1}. word: "${item.word}"\n   sentence: ${
          item.answer.trim() || "(no answer)"
        }`,
    )
    .join("\n");

  return [
    "You are grading an English vocabulary test. For each item the learner was asked to write one example sentence that uses the given word correctly.",
    "",
    "Mark an item correct only if the target word is used with the right meaning, the right part of speech, and natural collocation. Typos or small mistakes elsewhere in the sentence do not make an item incorrect — judge the use of the target word itself. An empty or off-topic answer is incorrect.",
    "",
    'Write a "comment" for every item, correct or not, in 1-3 sentences of plain English:',
    "- If correct, say briefly why the use works, and mention any nuance or a more natural phrasing if there is one.",
    "- If incorrect, say what is wrong and then give one corrected sentence using the word properly.",
    "",
    'Return one grade per item, with "position" set to the item number shown below.',
    "",
    "Items:",
    items,
  ].join("\n");
}

/**
 * Grades a whole test set in one call. The learner sees nothing until they
 * finish, so there is no reason to spend ten round trips — and one call also
 * lets the model keep its standard consistent across the items.
 */
export async function gradeAnswers({
  answers,
  askJson,
}: {
  answers: SubmittedAnswer[];
  askJson: <T>(input: string, schema: z.ZodType<T>) => Promise<Result<T>>;
}): Promise<Result<TestQuestion[]>> {
  const res = await askJson(buildGradingPrompt(answers), gradesSchema);
  if (!res.success) return res;

  // Positions are 1-based and come back from the model, so they are matched
  // rather than trusted as an order: a reordered or duplicated list must not
  // silently attach a comment to the wrong word.
  const byPosition = new Map(res.value.grades.map((g) => [g.position, g]));

  // A missing grade here or there degrades to "not graded", but a reply that
  // matches nothing is a broken grader, not a test the learner failed.
  if (answers.every((_answer, index) => !byPosition.has(index + 1))) {
    return {
      success: false,
      error: new Error("Grader returned no usable grades"),
    };
  }

  // Pairing happens here rather than in the route so that the word, what the
  // learner wrote, and the verdict can never drift apart downstream.
  const graded = answers.map((item, index): TestQuestion => {
    const grade = byPosition.get(index + 1);
    return {
      position: index + 1,
      word: item.word,
      answer: item.answer,
      correct: grade?.correct ?? false,
      comment: grade?.comment ?? "This answer could not be graded.",
    };
  });

  return { success: true, value: graded };
}

export function toTestSummary(
  row: tests & { questions: { word: string; correct: boolean }[] },
): TestSummary {
  return {
    id: row.id,
    correctCount: row.questions.filter((question) => question.correct).length,
    words: row.questions.map((question) => question.word),
    createdAt: row.created_at.toISOString(),
  };
}

export function toTestEntry(
  row: tests & { questions: test_questions[] },
): TestEntry {
  return {
    ...toTestSummary(row),
    questions: row.questions.map(
      (question): TestQuestion => ({
        position: question.position,
        word: question.word,
        answer: question.answer,
        correct: question.correct,
        comment: question.comment,
      }),
    ),
  };
}
