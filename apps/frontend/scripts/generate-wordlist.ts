/**
 * Regenerates src/lib/wordlist/english-words.txt, the dictionary behind the
 * composer's word autocomplete.
 *
 * Run by hand, never from dev/build/CI:
 *
 *   pnpm --filter frontend wordlist:generate
 *
 * Two upstreams are merged: SCOWL/ESDB decides which spellings are real words,
 * and the Google unigram counts decide the order they are suggested in. The
 * output is written in descending frequency order, so at runtime a line's index
 * is its frequency rank and a prefix scan needs no sorting of its own.
 *
 * See src/lib/wordlist/NOTICE.md for sources and licences.
 */

import { writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

// SCOWL size 60 ("large"): common enough to exclude noise, wide enough to cover
// the obscure words this app exists to explain.
const SPELLING_URL =
  "https://app.aspell.net/create?max_size=60&spelling=US&max_variant=0&diacritic=strip&download=wordlist&encoding=utf-8&format=inline";
const FREQUENCY_URL = "https://norvig.com/ngrams/count_1w.txt";

// The inline SCOWL response is a licence header, a line containing only "---",
// then one word per line.
const HEADER_SEPARATOR = "\n---\n";

const OUTPUT_PATH = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "../src/lib/wordlist/english-words.txt",
);

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(
      `GET ${url} failed: ${response.status} ${response.statusText}`,
    );
  }
  return response.text();
}

async function fetchSpellings(): Promise<string[]> {
  const raw = await fetchText(SPELLING_URL);
  const separatorIndex = raw.indexOf(HEADER_SEPARATOR);
  if (separatorIndex === -1) {
    throw new Error(
      `Could not find the "---" header separator in the SCOWL response; the upstream format changed.`,
    );
  }

  return raw.slice(separatorIndex + HEADER_SEPARATOR.length).split("\n");
}

async function fetchFrequencies(): Promise<Map<string, number>> {
  const raw = await fetchText(FREQUENCY_URL);
  const frequencies = new Map<string, number>();

  for (const line of raw.split("\n")) {
    const [word, count] = line.split("\t");
    if (!word || !count) continue;
    frequencies.set(word, Number(count));
  }

  if (frequencies.size === 0) {
    throw new Error(
      "The frequency list came back empty; the upstream format changed.",
    );
  }

  return frequencies;
}

async function main(): Promise<void> {
  const [spellings, frequencies] = await Promise.all([
    fetchSpellings(),
    fetchFrequencies(),
  ]);

  // Proper nouns, possessives and single letters are noise in a suggestion list.
  const words = [
    ...new Set(
      spellings
        .map((word) => word.trim())
        .filter((word) => /^[a-z]{2,}$/.test(word)),
    ),
  ];

  // Words missing from the corpus all score 0 and fall into one alphabetical
  // tail after the ranked words.
  words.sort(
    (a, b) =>
      (frequencies.get(b) ?? 0) - (frequencies.get(a) ?? 0) ||
      a.localeCompare(b),
  );

  const output = `${words.join("\n")}\n`;
  await writeFile(OUTPUT_PATH, output, "utf8");

  const ranked = words.filter((word) => frequencies.has(word)).length;
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(
    `  words:   ${words.length} (${ranked} ranked, ${words.length - ranked} unranked)`,
  );
  console.log(`  size:    ${(output.length / 1024).toFixed(1)} KiB`);
  console.log(`  sources: ${SPELLING_URL}`);
  console.log(`           ${FREQUENCY_URL}`);
}

await main();
