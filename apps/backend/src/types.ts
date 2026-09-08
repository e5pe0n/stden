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
