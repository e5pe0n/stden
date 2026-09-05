/**
 * English word autocomplete for the chat composer.
 *
 * The dictionary is `wordlist/english-words.txt`, generated from the English
 * Speller Database (ESDB, Copyright 2000-2026 Kevin Atkinson) and ordered by
 * Google Web Trillion Word Corpus frequency. See `wordlist/NOTICE.md`.
 *
 * Because the file is written in descending frequency order, a line's index is
 * its frequency rank: scanning it top to bottom and stopping early yields the
 * most common matches first, with no sorting at query time.
 */

/** Shorter prefixes match too much of a 79k-word list to be useful. */
const MIN_PREFIX_LENGTH = 2;
const MAX_SUGGESTIONS = 8;

const NO_MATCHES: readonly string[] = [];

export type WordToken = {
  word: string;
  start: number;
  end: number;
};

let wordListPromise: Promise<readonly string[]> | null = null;
let loadedWordList: readonly string[] | null = null;

/**
 * Loads the dictionary on first use. The import is dynamic so the word list
 * ships as its own chunk instead of weighing down the initial page load.
 */
export function loadWordList(): Promise<readonly string[]> {
  wordListPromise ??= import("./wordlist/english-words.txt?raw").then(
    (module) => {
      loadedWordList = module.default.trimEnd().split("\n");
      return loadedWordList;
    },
  );

  return wordListPromise;
}

/**
 * The dictionary if it is already in memory, so a render can match against it
 * without waiting a frame for an effect to deliver the same answer.
 */
export function getLoadedWordList(): readonly string[] | null {
  return loadedWordList;
}

function matchPrefixCase(word: string, prefix: string): string {
  const firstChar = prefix[0];
  if (!firstChar || firstChar === firstChar.toLowerCase()) return word;

  return word[0]!.toUpperCase() + word.slice(1);
}

/**
 * Returns up to {@link MAX_SUGGESTIONS} words starting with `prefix`, most
 * common first. The prefix itself is never suggested — there would be nothing
 * left to complete.
 */
export function searchWords(
  words: readonly string[],
  prefix: string,
): readonly string[] {
  const normalized = prefix.toLowerCase();
  if (normalized.length < MIN_PREFIX_LENGTH) return NO_MATCHES;

  const matches: string[] = [];
  for (const word of words) {
    if (word === normalized || !word.startsWith(normalized)) continue;

    matches.push(matchPrefixCase(word, prefix));
    if (matches.length === MAX_SUGGESTIONS) break;
  }

  return matches;
}

function isLetter(char: string | undefined): boolean {
  return char !== undefined && /^[a-zA-Z]$/.test(char);
}

/**
 * Finds the word being typed at `caret`, or null when there is nothing to
 * complete there: mid-word, too short, or a slash command like `/mea`.
 */
export function getWordTokenAtCaret(
  value: string,
  caret: number,
): WordToken | null {
  // Only complete at the end of a word, the way an editor does.
  if (isLetter(value[caret])) return null;

  let start = caret;
  while (start > 0 && isLetter(value[start - 1])) {
    start -= 1;
  }

  // `/mea` belongs to the command menu, not the dictionary.
  if (value[start - 1] === "/") return null;

  const word = value.slice(start, caret);
  if (word.length < MIN_PREFIX_LENGTH) return null;

  return { word, start, end: caret };
}
