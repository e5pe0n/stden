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

/** How many words a test set holds. */
export const TEST_WORD_COUNT = 10;

/** One word of a test set, once it has been answered and graded. */
export type TestQuestion = {
  position: number;
  word: string;
  answer: string;
  /** `null` when the grader returned no verdict for this item. */
  correct: boolean | null;
  comment: string;
};

/** What the sidebar lists — enough to label a past test, without the bodies. */
export type TestSummary = {
  id: number;
  /** How many words were used correctly. `words.length` is the total. */
  correctCount: number;
  words: string[];
  createdAt: string;
};

/** A finished test with every answer, verdict and comment. */
export type TestEntry = TestSummary & {
  questions: TestQuestion[];
};

/** What was done on one calendar day, in the learner's time zone. */
export type ActivityDay = {
  /** `YYYY-MM-DD`. */
  date: string;
  asks: number;
  tests: number;
};

/** One saved word with what the word list shows about it. */
export type WordEntry = {
  word: string;
  /** How many times it has been looked up, the first time included. */
  askedCount: number;
  /** How many tests have asked it, graded or not. */
  testedCount: number;
  correctCount: number;
  incorrectCount: number;
  /** How long it stays remembered, from its graded answers — the shorter, the
   *  harder the word is for the learner. `null` until it has been graded. */
  halfLifeDays: number | null;
  /** The definition paragraph of the saved explanation, as plain text. */
  meaning: string;
  createdAt: string;
};
