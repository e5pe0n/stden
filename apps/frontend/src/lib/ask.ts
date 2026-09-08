export const ASK_TYPES = ["meaning", "diff", "free"] as const;

export type AskType = (typeof ASK_TYPES)[number];

export type AskPayload =
  | { type: "meaning"; input: string; regenerate?: boolean }
  | { type: "diff"; input: string[] }
  | { type: "free"; input: string };

/**
 * Reads composer text as a request. Bare text is a word lookup; a leading
 * slash selects one of the other modes.
 */
export function parseAskPayload(rawText: string): AskPayload | null {
  const text = rawText.trim();
  if (!text) return null;

  const slashMatch = text.match(/^\/(meaning|diff|free)\s+(.*)$/i);
  if (!slashMatch) {
    return { type: "meaning", input: text };
  }

  const mode = slashMatch[1].toLowerCase() as AskType;
  const rest = slashMatch[2].trim();
  if (!rest) return null;

  if (mode === "diff") {
    const words = rest
      .split(/,|\n|\s+vs\s+/i)
      .map((word) => word.trim())
      .filter(Boolean);

    if (words.length < 2) return null;
    return {
      type: "diff",
      input: words,
    };
  }

  return {
    type: mode,
    input: rest,
  };
}
