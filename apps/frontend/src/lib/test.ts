import { z } from "zod";
import { config } from "@/config";

/** How many words one test holds. */
export const TEST_WORD_COUNT = 10;

const testSummarySchema = z.object({
  id: z.number().int(),
  /** How many words were used correctly. `words.length` is the total. */
  correctCount: z.number().int(),
  words: z.array(z.string()),
  createdAt: z.string(),
});

const testQuestionSchema = z.object({
  position: z.number().int(),
  word: z.string(),
  answer: z.string(),
  correct: z.boolean(),
  comment: z.string(),
});

const testEntrySchema = testSummarySchema.extend({
  questions: z.array(testQuestionSchema),
});

const newTestResponseSchema = z.object({
  words: z.array(z.string()).min(1),
});

const testListResponseSchema = z.object({
  tests: z.array(testSummarySchema),
});

const testDetailResponseSchema = z.object({
  test: testEntrySchema,
});

const notEnoughWordsSchema = z.object({
  available: z.number().int(),
  required: z.number().int(),
});

/** A row in the sidebar: one past test, without the answers or comments. */
export type TestSummary = z.infer<typeof testSummarySchema>;

/** One graded word: what was asked, what was written, and how it scored. */
export type TestQuestion = z.infer<typeof testQuestionSchema>;

/** A finished test with every answer and comment, shown after grading. */
export type TestEntry = z.infer<typeof testEntrySchema>;

/**
 * Raised when the dictionary is too small to draw a test set from. It carries
 * the counts so the start screen can say how many more words are needed
 * instead of only that something went wrong.
 */
export class NotEnoughWordsError extends Error {
  readonly available: number;
  readonly required: number;

  constructor(available: number, required: number) {
    super("Not enough words yet");
    this.name = "NotEnoughWordsError";
    this.available = available;
    this.required = required;
  }
}

const testsUrl = `${config.backendApiEndpoint}/tests`;

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

/** Draws a fresh set of words. Nothing is stored until the test is submitted. */
export async function fetchNewTestWords(
  signal?: AbortSignal,
): Promise<string[]> {
  const response = await fetch(`${testsUrl}/new`, { signal });

  if (response.status === 409) {
    const parsed = notEnoughWordsSchema.safeParse(await response.json());
    throw parsed.success
      ? new NotEnoughWordsError(parsed.data.available, parsed.data.required)
      : new NotEnoughWordsError(0, TEST_WORD_COUNT);
  }

  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }

  return newTestResponseSchema.parse(await response.json()).words;
}

/** Sends the finished set for grading. The graded test comes back saved. */
export async function submitTest(
  answers: readonly { word: string; answer: string }[],
  signal?: AbortSignal,
): Promise<TestEntry> {
  const data = await requestJson(testsUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ answers }),
    signal,
  });
  return testDetailResponseSchema.parse(data).test;
}

export async function fetchTests(signal?: AbortSignal): Promise<TestSummary[]> {
  const data = await requestJson(testsUrl, { signal });
  return testListResponseSchema.parse(data).tests;
}

export async function fetchTest(
  id: number,
  signal?: AbortSignal,
): Promise<TestEntry> {
  const data = await requestJson(`${testsUrl}/${id}`, { signal });
  return testDetailResponseSchema.parse(data).test;
}

export async function deleteTest(id: number): Promise<void> {
  const response = await fetch(`${testsUrl}/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
}

/** Drops the answers and comments, matching what the list endpoint returns. */
export function toTestSummary(entry: TestEntry): TestSummary {
  const { questions: _questions, ...summary } = entry;
  return summary;
}
