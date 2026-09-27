import useSWR from "swr";
import { z } from "zod";
import { config } from "@/config";

const wordEntrySchema = z.object({
  word: z.string(),
  askedCount: z.number().int(),
  testedCount: z.number().int(),
  correctCount: z.number().int(),
  incorrectCount: z.number().int(),
  /** How long the word stays remembered; `null` until it has been graded. */
  halfLifeDays: z.number().nullable(),
  /** The definition paragraph of the saved explanation, as plain text. */
  meaning: z.string(),
  createdAt: z.string(),
});

const wordsResponseSchema = z.object({
  words: z.array(wordEntrySchema),
});

export type WordEntry = z.infer<typeof wordEntrySchema>;

/** A word as the list shows it: the server's entry plus its corpus rank. */
export type WordRow = WordEntry & {
  /** 1-based rank in the autocomplete dictionary, most common first; `null`
   *  for phrases and anything else the dictionary doesn't hold. */
  frequencyRank: number | null;
};

export type Difficulty = "hard" | "medium" | "easy";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = {
  hard: "Hard",
  medium: "Medium",
  easy: "Easy",
};

/**
 * Difficulty is read off the word's half-life. A wrong answer resets it to a
 * day, so "hard" is a word last missed; each right answer at least doubles it,
 * so it takes a few in a row to reach "easy".
 */
export function toDifficulty(halfLifeDays: number | null): Difficulty | null {
  if (halfLifeDays === null) return null;
  if (halfLifeDays < 2) return "hard";
  if (halfLifeDays < 8) return "medium";
  return "easy";
}

/** Every saved word. Revalidated on each mount, since the list is opened to
 *  see what the latest lookups and tests changed. */
export function useWords() {
  return useSWR(`${config.backendApiEndpoint}/words`, async (url: string) => {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Request failed with status ${response.status}`);
    }
    return wordsResponseSchema.parse(await response.json()).words;
  });
}

/** The dictionary indexed by word, so each row finds its rank in O(1). */
export function toRankIndex(
  dictionary: readonly string[],
): ReadonlyMap<string, number> {
  return new Map(dictionary.map((word, index) => [word, index + 1]));
}

export function toWordRows(
  words: readonly WordEntry[],
  ranks: ReadonlyMap<string, number> | null,
): WordRow[] {
  return words.map((entry) => ({
    ...entry,
    frequencyRank: ranks?.get(entry.word.toLowerCase()) ?? null,
  }));
}

export type SortKey =
  | "word"
  | "difficulty"
  | "frequency"
  | "asked"
  | "tested"
  | "correct"
  | "incorrect";

export type SortDirection = "asc" | "desc";

export type Sort = { key: SortKey; direction: SortDirection };

/**
 * The value each column sorts on. "Ascending" reads the way the column does:
 * difficulty runs hard → easy (shortest half-life first) and frequency runs
 * common → rare (lowest rank first). `null` is a row the column says nothing
 * about, and always goes last whichever way the column is sorted.
 */
const SORT_VALUES: Record<SortKey, (row: WordRow) => string | number | null> = {
  word: (row) => row.word.toLowerCase(),
  difficulty: (row) => row.halfLifeDays,
  frequency: (row) => row.frequencyRank,
  asked: (row) => row.askedCount,
  tested: (row) => row.testedCount,
  correct: (row) => row.correctCount,
  incorrect: (row) => row.incorrectCount,
};

/** Counts read best largest first; everything else starts at its natural end. */
export const DEFAULT_DIRECTIONS: Record<SortKey, SortDirection> = {
  word: "asc",
  difficulty: "asc",
  frequency: "asc",
  asked: "desc",
  tested: "desc",
  correct: "desc",
  incorrect: "desc",
};

export function sortWordRows(rows: readonly WordRow[], sort: Sort): WordRow[] {
  const value = SORT_VALUES[sort.key];
  const sign = sort.direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const left = value(a);
    const right = value(b);
    if (left === null || right === null) {
      if (left !== right) return left === null ? 1 : -1;
    } else if (left !== right) {
      return (left < right ? -1 : 1) * sign;
    }
    // Ties fall back to the word, so equal counts don't shuffle on re-sort.
    return a.word.localeCompare(b.word);
  });
}

/** Rows whose word contains `query`, ignoring case. */
export function filterWordRows(
  rows: readonly WordRow[],
  query: string,
): readonly WordRow[] {
  const normalized = query.trim().toLowerCase();
  if (normalized === "") return rows;
  return rows.filter((row) => row.word.toLowerCase().includes(normalized));
}
