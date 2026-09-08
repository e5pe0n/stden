import type { histories } from "../generated/prisma/index.js";
import type { AskRequest, HistoryEntry, HistorySummary } from "./types.js";

/**
 * How many recent asks the sidebar lists. High enough that a personal
 * dictionary never scrolls off it, low enough to stay one small response.
 */
export const HISTORY_LIST_LIMIT = 200;

/**
 * The canonical text of an ask, as the composer would show it. Only the parsed
 * payload reaches the server, never the raw keystrokes, so `/diff a vs b` and
 * `/diff a, b` both come back in one spelling.
 */
export function toQuestionText(payload: AskRequest): string {
  switch (payload.type) {
    case "meaning":
      return payload.input;
    case "diff":
      return `/diff ${payload.input.join(", ")}`;
    case "free":
      return `/free ${payload.input}`;
  }
}

export function toHistorySummary(row: histories): HistorySummary {
  return {
    id: row.id,
    type: row.type,
    question: row.question,
    createdAt: row.created_at.toISOString(),
  };
}

export function toHistoryEntry(row: histories): HistoryEntry {
  return {
    ...toHistorySummary(row),
    answer: row.answer,
  };
}
