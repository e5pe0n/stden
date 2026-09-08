import { z } from "zod";
import { config } from "@/config";
import { ASK_TYPES } from "@/lib/ask";

const historySummarySchema = z.object({
  id: z.number().int(),
  type: z.enum(ASK_TYPES),
  question: z.string(),
  createdAt: z.string(),
});

const historyEntrySchema = historySummarySchema.extend({
  answer: z.string(),
});

const historyListResponseSchema = z.object({
  histories: z.array(historySummarySchema),
});

const historyDetailResponseSchema = z.object({
  history: historyEntrySchema,
});

/** A row in the sidebar: one meaning, diff or free ask, without its answer. */
export type HistorySummary = z.infer<typeof historySummarySchema>;

/** A history row with the answer body, loaded when the row is opened. */
export type HistoryEntry = z.infer<typeof historyEntrySchema>;

/**
 * The ask endpoint returns the row it recorded so the sidebar can prepend it
 * without refetching the whole list. It is optional because a failed history
 * write still returns a perfectly good answer.
 */
export const askResponseSchema = z.object({
  text: z.string().optional(),
  history: historySummarySchema.optional(),
});

const historiesUrl = `${config.backendApiEndpoint}/histories`;

async function requestJson(url: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(url, init);
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
  return response.json();
}

export async function fetchHistories(
  signal?: AbortSignal,
): Promise<HistorySummary[]> {
  const data = await requestJson(historiesUrl, { signal });
  return historyListResponseSchema.parse(data).histories;
}

export async function fetchHistory(
  id: number,
  signal?: AbortSignal,
): Promise<HistoryEntry> {
  const data = await requestJson(`${historiesUrl}/${id}`, { signal });
  return historyDetailResponseSchema.parse(data).history;
}

export async function deleteHistory(id: number): Promise<void> {
  const response = await fetch(`${historiesUrl}/${id}`, { method: "DELETE" });
  if (!response.ok) {
    throw new Error(`Request failed with status ${response.status}`);
  }
}

const RELATIVE_TIME_UNITS = [
  { limitMs: 60_000, divisorMs: 1_000, unit: "second" },
  { limitMs: 3_600_000, divisorMs: 60_000, unit: "minute" },
  { limitMs: 86_400_000, divisorMs: 3_600_000, unit: "hour" },
  { limitMs: 604_800_000, divisorMs: 86_400_000, unit: "day" },
] as const;

const relativeFormatter = new Intl.RelativeTimeFormat(undefined, {
  numeric: "auto",
});
const dateFormatter = new Intl.DateTimeFormat(undefined, {
  month: "short",
  day: "numeric",
});

/** "3 minutes ago" while that is still meaningful, then a plain date. */
export function formatHistoryTime(createdAt: string): string {
  const timestamp = Date.parse(createdAt);
  if (Number.isNaN(timestamp)) return "";

  const elapsedMs = Date.now() - timestamp;
  if (elapsedMs < 0) return relativeFormatter.format(0, "second");

  for (const { limitMs, divisorMs, unit } of RELATIVE_TIME_UNITS) {
    if (elapsedMs < limitMs) {
      return relativeFormatter.format(-Math.floor(elapsedMs / divisorMs), unit);
    }
  }

  return dateFormatter.format(timestamp);
}
