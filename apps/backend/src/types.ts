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
