import { findMeaning, insertMeaning, updateMeaning } from "./db.js";
import type { AskRequest, Result } from "./types.js";

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

    const input = `Teach me the word "${word}" with this exact structure: 1) meaning 2) at least 3 example sentences 3) synonyms. If the word is misspelled, start with "misspelled!" and list possible correct words only.`;

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

function buildDiffPrompt(words: string[]) {
  return [
    `Compare these words and explain their differences: ${words.join(", ")}.`,
    "Explain when to choose each word in practical situations.",
    "Include concise example sentences for each word.",
  ].join(" ");
}

function buildFreePrompt(input: string) {
  return input;
}

export async function handleAskByType({
  ask,
  payload,
}: {
  payload: AskRequest;
  ask: (input: string) => Promise<Result<string>>;
}): Promise<Result<string>> {
  switch (payload.type) {
    case "meaning":
      return handleMeaning({
        word: payload.input,
        ask,
      });
    case "diff":
      return ask(buildDiffPrompt(payload.input));
    case "free":
      return ask(buildFreePrompt(payload.input));
    default:
      return {
        success: false,
        error: new Error("Unsupported ask type"),
      };
  }
}
