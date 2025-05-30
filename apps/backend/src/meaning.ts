import { findMeaning, insertMeaning, updateMeaning } from "./db.js";
import type { Result } from "./types.js";

export async function handleMeaning({
  word,
  ask,
}: {
  word: string;
  ask: (input: string) => Promise<Result<string>>;
}): Promise<Result<string>> {
  try {
    const meaningOrNull = await findMeaning({ word: word });
    if (meaningOrNull) {
      const meaning = meaningOrNull;
      await updateMeaning(
        { asked_count: meaning.asked_count + 1 },
        { id: meaning.id },
      );
      return { success: true, value: meaning.output };
    }

    const input = `teach me word "${word}". 1) the meaning 2) example sentences with Japanese translation without romanization and 3) synonyms. only if given word is misspelled then just say "misspelled!" first and enumerate possibly correct words without meaning and or so.`;

    const res = await ask(input);
    if (res.success && !res.value.match(/misspelled!/)) {
      await insertMeaning({
        word,
        input,
        output: res.value,
      });
    }
    return res;
  } catch (error) {
    return {
      success: false,
      error: new Error("handle meaning failed", {
        cause: error,
      }),
    };
  }
}
