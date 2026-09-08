export type SuccessResult<V = unknown> = {
  success: true;
  value: V;
};

export type ErrorResult<E = Error> = {
  success: false;
  error: E;
};

export type Result<V = unknown, E = Error> = SuccessResult<V> | ErrorResult<E>;

export type AskRequest =
  | {
      type: "meaning";
      input: string;
      regenerate?: boolean;
    }
  | {
      type: "diff";
      input: string[];
    }
  | {
      type: "free";
      input: string;
    };

export type AskType = AskRequest["type"];

/** What the sidebar lists — everything but the answer body. */
export type HistorySummary = {
  id: number;
  type: AskType;
  question: string;
  createdAt: string;
};

/** A history entry with the answer, fetched when an entry is opened. */
export type HistoryEntry = HistorySummary & {
  answer: string;
};

/** How many words a test set holds, and — at 10 points each — a perfect 100. */
export const TEST_WORD_COUNT = 10;

/** Points awarded per correctly used word. */
export const POINTS_PER_WORD = 100 / TEST_WORD_COUNT;

/** One word of a test set, once it has been answered and graded. */
export type TestQuestion = {
  position: number;
  word: string;
  answer: string;
  correct: boolean;
  comment: string;
};

/** What the sidebar lists — enough to label a past test, without the bodies. */
export type TestSummary = {
  id: number;
  score: number;
  words: string[];
  createdAt: string;
};

/** A finished test with every answer, verdict and comment. */
export type TestEntry = TestSummary & {
  questions: TestQuestion[];
};
