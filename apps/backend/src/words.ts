import { type GradedUse, replayMemory } from "./schedule.js";
import type { WordEntry } from "./types.js";

/** One saved word, as the word list reads it from `meanings`. */
export type SavedWord = {
  word: string;
  askedCount: number;
  output: string;
  createdAt: Date;
};

/** One answer to a word in a test, graded or not. */
export type TestUse = {
  word: string;
  correct: boolean | null;
  at: Date;
};

/**
 * The first paragraph under the answer's "Meaning" heading, as plain text.
 * Answers follow the prompt's "1) meaning 2) examples 3) synonyms" shape, so
 * the heading is dropped and the paragraph after it is the definition itself.
 * An answer in any other shape falls back to its first paragraph.
 */
export function toMeaningSummary(output: string): string {
  const paragraphs = output
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  const first = paragraphs[0] ?? "";
  const headingMatch = first.match(
    /^[#*\s]*\d[).]\s*\**\s*(?:the\s+)?meaning\s*\**\s*:?\s*\**\s*/i,
  );
  const text = headingMatch
    ? first.slice(headingMatch[0].length).trim() || (paragraphs[1] ?? "")
    : first;

  return text
    .replace(/\*\*|__|[*_`#]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Every saved word with how it has been asked and tested. Difficulty is the
 * scheduler's half-life for the word — the same memory that picks test words,
 * replayed here so the list can never disagree with what a test would ask.
 */
export function toWordEntries({
  words,
  uses,
}: {
  words: readonly SavedWord[];
  uses: readonly TestUse[];
}): WordEntry[] {
  const usesByWord = new Map<string, TestUse[]>();
  for (const use of uses) {
    const list = usesByWord.get(use.word);
    if (list) list.push(use);
    else usesByWord.set(use.word, [use]);
  }

  return words.map((saved): WordEntry => {
    const wordUses = usesByWord.get(saved.word) ?? [];
    const graded = wordUses.filter(
      (use): use is GradedUse => use.correct !== null,
    );
    const memory = replayMemory(graded);

    return {
      word: saved.word,
      // `asked_count` counts lookups after the first — the row is created by
      // the first one with the column still at its default of 0.
      askedCount: saved.askedCount + 1,
      testedCount: wordUses.length,
      correctCount: graded.filter((use) => use.correct).length,
      incorrectCount: graded.filter((use) => !use.correct).length,
      halfLifeDays: memory?.halfLifeDays ?? null,
      meaning: toMeaningSummary(saved.output),
      createdAt: saved.createdAt.toISOString(),
    };
  });
}
