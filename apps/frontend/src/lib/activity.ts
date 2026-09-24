import useSWR from "swr";
import { z } from "zod";
import { config } from "@/config";

const activityDaySchema = z.object({
  /** `YYYY-MM-DD`, in the time zone the overview was requested in. */
  date: z.string(),
  asks: z.number().int(),
  tests: z.number().int(),
});

const activityResponseSchema = z.object({
  days: z.array(activityDaySchema),
});

/** One day with any activity. Days without any are never sent. */
export type ActivityDay = z.infer<typeof activityDaySchema>;

/** One square of the calendar. */
export type CalendarDay = {
  date: string;
  asks: number;
  tests: number;
  isFuture: boolean;
};

export type ActivitySummary = {
  /** Totals over the days the calendar shows. */
  asks: number;
  tests: number;
  activeDays: number;
  /** Consecutive active days ending today — or yesterday, since a streak
   *  isn't broken until today is over. */
  currentStreak: number;
  /** All-time, not just the calendar's year. */
  longestStreak: number;
};

/** A year, rounded up to whole weeks so the grid is a full rectangle. */
export const CALENDAR_WEEKS = 53;

/** Squares are shaded in this many steps above "nothing that day". */
export const ACTIVITY_LEVELS = 4;

const DAY_MS = 86_400_000;

/**
 * Activity per day. The new-chat welcome and the Activity page share this
 * one cache entry, so whichever opens second draws at once from the first's
 * data; it is still revalidated on every mount, since the point of opening
 * either is to see what was just done.
 */
export function useActivity() {
  // Days are cut on the server, so it has to be told where midnight is.
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const params = new URLSearchParams({ tz: timeZone });
  return useSWR(
    `${config.backendApiEndpoint}/activity?${params}`,
    async (url: string) => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return activityResponseSchema.parse(await response.json()).days;
    },
  );
}

/** The local calendar date of `date`, in the key format the server uses. */
export function toDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Days since the epoch, so keys can be stepped and compared as integers
 *  without a daylight-saving shift ever skipping or repeating a day. */
function toDayNumber(key: string): number {
  const [year, month, day] = key.split("-").map(Number);
  return Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1) / DAY_MS;
}

function fromDayNumber(dayNumber: number): string {
  return new Date(dayNumber * DAY_MS).toISOString().slice(0, 10);
}

/**
 * The calendar as columns of weeks, Sunday on top, the last column holding
 * today. Like GitHub's, it starts on the Sunday `CALENDAR_WEEKS - 1` weeks
 * before this one, so the first column is always a whole week.
 */
export function buildCalendar(
  days: readonly ActivityDay[],
  today: Date,
): CalendarDay[][] {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const todayNumber = toDayNumber(toDateKey(today));
  const start = todayNumber - today.getDay() - (CALENDAR_WEEKS - 1) * 7;

  return Array.from({ length: CALENDAR_WEEKS }, (_week, week) =>
    Array.from({ length: 7 }, (_day, weekday) => {
      const dayNumber = start + week * 7 + weekday;
      const date = fromDayNumber(dayNumber);
      const activity = byDate.get(date);
      return {
        date,
        asks: activity?.asks ?? 0,
        tests: activity?.tests ?? 0,
        isFuture: dayNumber > todayNumber,
      };
    }),
  );
}

export function summarizeActivity(
  days: readonly ActivityDay[],
  calendar: readonly CalendarDay[][],
  today: Date,
): ActivitySummary {
  let asks = 0;
  let tests = 0;
  let activeDays = 0;
  for (const day of calendar.flat()) {
    asks += day.asks;
    tests += day.tests;
    if (day.asks + day.tests > 0) activeDays++;
  }

  const active = new Set(
    days.filter((day) => day.asks + day.tests > 0).map((day) => day.date),
  );

  let longestStreak = 0;
  let run = 0;
  let previous: number | null = null;
  for (const dayNumber of [...active].map(toDayNumber).sort((a, b) => a - b)) {
    run = previous !== null && dayNumber === previous + 1 ? run + 1 : 1;
    longestStreak = Math.max(longestStreak, run);
    previous = dayNumber;
  }

  const todayNumber = toDayNumber(toDateKey(today));
  let cursor = active.has(fromDayNumber(todayNumber))
    ? todayNumber
    : todayNumber - 1;
  let currentStreak = 0;
  while (active.has(fromDayNumber(cursor))) {
    currentStreak++;
    cursor--;
  }

  return { asks, tests, activeDays, currentStreak, longestStreak };
}

/**
 * How dark a square is, from 0 (nothing) to `ACTIVITY_LEVELS`. Scaled to the
 * busiest day on the calendar rather than fixed thresholds, so a light
 * learner's year still shows its shape instead of one flat shade.
 */
export function toActivityLevel(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.min(ACTIVITY_LEVELS, Math.ceil((count / max) * ACTIVITY_LEVELS));
}
