import useSWR from "swr";
import { z } from "zod";
import { config } from "@/config";

const meaningResponseSchema = z.object({
  meaning: z.object({
    word: z.string(),
    /** The markdown explanation saved when the word was first asked about. */
    text: z.string(),
  }),
});

/** Raised when the word has no saved explanation, so the caller can say so
 *  instead of reporting a failure. */
export class MeaningNotFoundError extends Error {
  constructor() {
    super("No saved meaning for this word");
    this.name = "MeaningNotFoundError";
  }
}

const meaningsUrl = `${config.backendApiEndpoint}/meanings`;

/**
 * The saved explanation of `word`, or nothing while `word` is null — callers
 * pass null until the meaning is actually opened, so a result page does not
 * fetch ten markdown documents nobody asked to read. Keyed by URL, so the same
 * word opened twice, or in two tests, is fetched once.
 */
export function useMeaning(word: string | null) {
  return useSWR(
    word === null ? null : `${meaningsUrl}/${encodeURIComponent(word)}`,
    async (url: string) => {
      const response = await fetch(url);
      if (response.status === 404) throw new MeaningNotFoundError();
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return meaningResponseSchema.parse(await response.json()).meaning.text;
    },
    // A saved meaning only changes when the word is regenerated in Learn, and
    // a refetch on every tab switch would be pure noise.
    { revalidateOnFocus: false, shouldRetryOnError: false },
  );
}
