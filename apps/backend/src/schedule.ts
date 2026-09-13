/**
 * Picks the words a test asks, favouring the ones most likely forgotten.
 *
 * Each word's memory is a half-life: how long until the chance of recalling it
 * falls to one half. It is replayed from the word's graded answers rather than
 * stored, so it can never drift from the history it is read from — and a
 * personal dictionary is small enough to replay whole on every new test.
 */

const DAY_MS = 86_400_000;

/** Half-life before a word is first answered, and after it is answered wrong. */
const BASE_HALF_LIFE_DAYS = 1;

/** Keeps even a word known for years in rotation, if rarely. */
const MAX_HALF_LIFE_DAYS = 365;

/** Tested words below this chance of recall are due for review. */
const DUE_RECALL = 0.9;

/** How many of a test's slots go to due words before untested ones get theirs. */
const REVIEW_SLOTS = 7;

/** A word tested this recently goes last, so back-to-back tests don't repeat it. */
const COOLDOWN_MS = 12 * 60 * 60 * 1000;

/** A word a test can ask. */
export type Candidate = {
  word: string;
  /** How often it was looked up — a word looked up again and again is one the
   *  learner is unsure of, which makes it a good first test. */
  askedCount: number;
  createdAt: Date;
};

/** One graded answer. Ungraded ones say nothing about the learner, so they are
 *  never passed in. */
export type GradedUse = {
  word: string;
  correct: boolean;
  at: Date;
};

export type Memory = {
  halfLifeDays: number;
  lastAt: Date;
};

type Scored = { word: string; recall: number };

/**
 * Replays one word's graded answers into its memory, or `null` if it has none.
 * A right answer doubles the half-life — triples it if the word had outlived
 * its half-life, since remembering across a long gap is stronger evidence. A
 * wrong one sends it back to the start.
 */
export function replayMemory(uses: readonly GradedUse[]): Memory | null {
  let memory: Memory | null = null;

  for (const use of [...uses].sort((a, b) => a.at.getTime() - b.at.getTime())) {
    if (!use.correct) {
      memory = { halfLifeDays: BASE_HALF_LIFE_DAYS, lastAt: use.at };
      continue;
    }

    const halfLifeDays: number = memory?.halfLifeDays ?? BASE_HALF_LIFE_DAYS;
    const gapDays: number = memory
      ? (use.at.getTime() - memory.lastAt.getTime()) / DAY_MS
      : 0;
    const factor = gapDays > halfLifeDays ? 3 : 2;
    memory = {
      halfLifeDays: Math.min(halfLifeDays * factor, MAX_HALF_LIFE_DAYS),
      lastAt: use.at,
    };
  }

  return memory;
}

/** The chance of recalling a word at `now`: 1 just after its last test,
 *  halving with every half-life since. */
export function recallAt(memory: Memory, now: Date): number {
  const elapsedDays =
    Math.max(0, now.getTime() - memory.lastAt.getTime()) / DAY_MS;
  return 2 ** (-elapsedDays / memory.halfLifeDays);
}

/**
 * Up to `take` words: first the due words least likely recalled, up to
 * `REVIEW_SLOTS`, then untested words for the rest. A pool that runs short is
 * backfilled from the next — leftover due words, then well-known ones, then
 * the ones tested within the cooldown — so a small dictionary still fills a
 * test. The result is shuffled so reviews and new words don't come in blocks.
 */
export function pickTestWords({
  candidates,
  uses,
  take,
  now = new Date(),
  random = Math.random,
}: {
  candidates: readonly Candidate[];
  uses: readonly GradedUse[];
  take: number;
  now?: Date;
  random?: () => number;
}): string[] {
  const usesByWord = new Map<string, GradedUse[]>();
  for (const use of uses) {
    const list = usesByWord.get(use.word);
    if (list) list.push(use);
    else usesByWord.set(use.word, [use]);
  }

  const fresh: Candidate[] = [];
  const due: Scored[] = [];
  const known: Scored[] = [];
  const resting: Scored[] = [];

  for (const candidate of candidates) {
    const memory = replayMemory(usesByWord.get(candidate.word) ?? []);
    if (!memory) {
      fresh.push(candidate);
      continue;
    }

    const scored = { word: candidate.word, recall: recallAt(memory, now) };
    if (now.getTime() - memory.lastAt.getTime() < COOLDOWN_MS) {
      resting.push(scored);
    } else if (scored.recall < DUE_RECALL) {
      due.push(scored);
    } else {
      known.push(scored);
    }
  }

  const byRecall = (a: Scored, b: Scored) => a.recall - b.recall;
  due.sort(byRecall);
  known.sort(byRecall);
  resting.sort(byRecall);
  fresh.sort(
    (a, b) =>
      b.askedCount - a.askedCount ||
      a.createdAt.getTime() - b.createdAt.getTime(),
  );

  const reviewCount = Math.min(REVIEW_SLOTS, take, due.length);
  const words = [
    ...due.slice(0, reviewCount),
    ...fresh,
    ...due.slice(reviewCount),
    ...known,
    ...resting,
  ]
    .slice(0, take)
    .map((item) => item.word);

  return shuffle(words, random);
}

/** Fisher–Yates, with the source of randomness passed in so tests can pin it. */
function shuffle<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j] as T, out[i] as T];
  }
  return out;
}
