import { Loader2Icon } from "lucide-react";
import {
  type FC,
  type KeyboardEvent,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ACTIVITY_LEVELS,
  type ActivityDay,
  buildCalendar,
  type CalendarDay,
  summarizeActivity,
  toActivityLevel,
  useActivity,
} from "@/lib/activity";
import { cn } from "@/lib/utils";

/** Square size plus the gap after it, in px — the grid's one unit. */
const CELL = 11;
const GAP = 3;
const STEP = CELL + GAP;

/** Every other row is labelled, as on GitHub: all seven would crowd. */
const WEEKDAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

const LEVEL_CLASSES = [
  "bg-foreground/[0.06]",
  "bg-activity-1",
  "bg-activity-2",
  "bg-activity-3",
  "bg-activity-4",
];

const monthFormat = new Intl.DateTimeFormat(undefined, {
  month: "short",
  timeZone: "UTC",
});
const dayFormat = new Intl.DateTimeFormat(undefined, {
  weekday: "short",
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

/** Calendar keys are dates, not instants, so they are read at UTC midnight
 *  and formatted in UTC — no zone can move them onto a neighbouring day. */
const parseKey = (key: string) => new Date(`${key}T00:00:00Z`);

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

const describeDay = (day: CalendarDay): string => {
  const parts = [
    day.asks > 0 ? plural(day.asks, "lookup") : null,
    day.tests > 0 ? plural(day.tests, "test") : null,
  ].filter(Boolean);
  const what = parts.length > 0 ? parts.join(", ") : "No activity";
  return `${what} on ${dayFormat.format(parseKey(day.date))}`;
};

const useCalendar = (days: readonly ActivityDay[]) => {
  // Sampled once: a view left open past midnight keeps yesterday's grid,
  // which is what a reload is for.
  const [today] = useState(() => new Date());
  const calendar = useMemo(() => buildCalendar(days, today), [days, today]);
  const summary = useMemo(
    () => summarizeActivity(days, calendar, today),
    [days, calendar, today],
  );
  return { calendar, summary };
};

export const ActivityView: FC = () => {
  const { data: days, error } = useActivity();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-8">
        <div className="space-y-1">
          <h1 className="text-xl font-medium">Activity</h1>
          <p className="text-muted-foreground text-sm">
            How often you have looked words up and tested yourself.
          </p>
        </div>

        {/* Cached days win over a failed refresh: last visit's calendar is
            more use than an error in its place. */}
        {days ? (
          <Overview days={days} />
        ) : error ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
          >
            Couldn't load your activity.
          </p>
        ) : (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Loader2Icon className="size-4 animate-spin" />
            Loading…
          </p>
        )}
      </div>
    </div>
  );
};

const Overview: FC<{ days: ActivityDay[] }> = ({ days }) => {
  const { calendar, summary } = useCalendar(days);

  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Lookups" value={summary.asks} note="past year" />
        <Stat label="Tests" value={summary.tests} note="past year" />
        <Stat
          label="Current streak"
          value={summary.currentStreak}
          unit={summary.currentStreak === 1 ? "day" : "days"}
        />
        <Stat
          label="Longest streak"
          value={summary.longestStreak}
          unit={summary.longestStreak === 1 ? "day" : "days"}
        />
      </dl>

      <section className="border-border rounded-lg border p-4">
        <h2 className="mb-3 text-sm">
          {plural(summary.activeDays, "active day")} in the past year
        </h2>
        <Heatmap calendar={calendar} />
      </section>
    </>
  );
};

/**
 * The same overview, for the welcome of a new chat — what a learner sees each
 * time they sit down, the way a new Claude Code session opens on its usage.
 * The chat is what they came for, so this stays out of its way: nothing while
 * loading, and nothing at all if the fetch fails.
 */
export const ActivityWelcome: FC = () => {
  const { data: days } = useActivity();
  if (!days) return null;
  return (
    <div className="fade-in animate-in flex flex-col gap-6 duration-200">
      <Overview days={days} />
    </div>
  );
};

const Stat: FC<{
  label: string;
  value: number;
  unit?: string;
  note?: string;
}> = ({ label, value, unit, note }) => (
  <div className="border-border rounded-lg border px-3 py-2.5">
    <dt className="text-muted-foreground text-xs">
      {label}
      {note ? <span className="sr-only"> ({note})</span> : null}
    </dt>
    <dd className="mt-0.5 text-2xl font-medium tabular-nums">
      {value.toLocaleString()}
      {unit ? (
        <span className="text-muted-foreground ms-1 text-sm font-normal">
          {unit}
        </span>
      ) : null}
    </dd>
  </div>
);

/** Where a month's label goes: the first column whose Sunday is in it. */
const toMonthLabels = (calendar: readonly CalendarDay[][]) => {
  const labels: { week: number; label: string }[] = [];
  let previousMonth = -1;
  calendar.forEach((week, index) => {
    const first = week[0];
    if (!first) return;
    const month = parseKey(first.date).getUTCMonth();
    if (month !== previousMonth) {
      labels.push({
        week: index,
        label: monthFormat.format(parseKey(first.date)),
      });
      previousMonth = month;
    }
  });
  // The first column is usually mid-month; if the next label follows within
  // a couple of columns the two would overlap, so the partial one goes.
  const [first, second] = labels;
  if (first && second && second.week - first.week < 3) labels.shift();
  return labels;
};

type Hover = { week: number; weekday: number; rect: DOMRect };

const Heatmap: FC<{ calendar: CalendarDay[][] }> = ({ calendar }) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const cellRefs = useRef(new Map<string, HTMLButtonElement>());
  const [hover, setHover] = useState<Hover | null>(null);

  // One tab stop for the whole grid; arrow keys move within it. It starts on
  // today, the square someone checking their streak is looking for.
  const lastWeek = calendar.length - 1;
  // Future days only ever trail the last week, so counting the rest finds today.
  const todayWeekday = Math.max(
    0,
    (calendar[lastWeek] ?? []).filter((day) => !day.isFuture).length - 1,
  );
  const [focus, setFocus] = useState({
    week: lastWeek,
    weekday: todayWeekday,
  });

  const max = useMemo(
    () => Math.max(0, ...calendar.flat().map((day) => day.asks + day.tests)),
    [calendar],
  );
  const monthLabels = useMemo(() => toMonthLabels(calendar), [calendar]);

  // The tooltip is pinned to where the square was; once anything scrolls it
  // would point at the wrong one.
  useEffect(() => {
    const clear = () => setHover(null);
    window.addEventListener("scroll", clear, true);
    return () => window.removeEventListener("scroll", clear, true);
  }, []);

  // On a narrow screen the grid scrolls sideways; start at the recent end.
  useLayoutEffect(() => {
    const scroller = scrollRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, []);

  const show = (week: number, weekday: number) => {
    const cell = cellRefs.current.get(`${week}:${weekday}`);
    if (cell) setHover({ week, weekday, rect: cell.getBoundingClientRect() });
  };

  const handleKeyDown = (event: KeyboardEvent) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();

    const week = focus.week + move[0];
    const weekday = focus.weekday + move[1];
    const target = calendar[week]?.[weekday];
    if (!target || target.isFuture) return;

    setFocus({ week, weekday });
    const cell = cellRefs.current.get(`${week}:${weekday}`);
    cell?.focus();
    cell?.scrollIntoView({ block: "nearest", inline: "nearest" });
  };

  const hovered = hover ? calendar[hover.week]?.[hover.weekday] : undefined;

  return (
    <div>
      <div ref={scrollRef} className="overflow-x-auto pb-1">
        <div
          className="grid w-max"
          style={{ gridTemplateColumns: `auto ${calendar.length * STEP}px` }}
        >
          {/* The label column stays put while the weeks scroll under it, so
              a phone scrolled back to winter still knows which row is Monday. */}
          <div className="bg-background sticky start-0 z-10" />
          <div className="text-muted-foreground relative h-5 text-xs">
            {monthLabels.map(({ week, label }) => (
              <span
                key={week}
                className="absolute top-0"
                style={{ left: week * STEP }}
              >
                {label}
              </span>
            ))}
          </div>

          <div
            aria-hidden
            className="text-muted-foreground bg-background sticky start-0 z-10 flex flex-col pe-2 text-xs"
            style={{ gap: GAP }}
          >
            {WEEKDAY_LABELS.map((label, index) => (
              <span
                // biome-ignore lint/suspicious/noArrayIndexKey: fixed rows
                key={index}
                className="leading-none"
                style={{ height: CELL, lineHeight: `${CELL}px` }}
              >
                {label}
              </span>
            ))}
          </div>

          <fieldset
            className="flex"
            style={{ gap: GAP }}
            onKeyDown={handleKeyDown}
            onMouseLeave={() => setHover(null)}
          >
            <legend className="sr-only">
              Activity calendar. Use the arrow keys to move between days.
            </legend>
            {calendar.map((week, weekIndex) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: columns are positional
                key={weekIndex}
                className="flex flex-col"
                style={{ gap: GAP }}
              >
                {week.map((day, weekday) => {
                  if (day.isFuture) {
                    return (
                      <span
                        key={day.date}
                        aria-hidden
                        style={{ width: CELL, height: CELL }}
                      />
                    );
                  }
                  const level = toActivityLevel(day.asks + day.tests, max);
                  const isFocusTarget =
                    focus.week === weekIndex && focus.weekday === weekday;
                  return (
                    <button
                      key={day.date}
                      ref={(node) => {
                        const key = `${weekIndex}:${weekday}`;
                        if (node) cellRefs.current.set(key, node);
                        else cellRefs.current.delete(key);
                      }}
                      type="button"
                      tabIndex={isFocusTarget ? 0 : -1}
                      aria-label={describeDay(day)}
                      className={cn(
                        "rounded-[2px] outline-offset-1 focus-visible:outline-2 focus-visible:outline-ring",
                        LEVEL_CLASSES[level],
                      )}
                      style={{ width: CELL, height: CELL }}
                      onMouseEnter={() => show(weekIndex, weekday)}
                      onFocus={() => {
                        setFocus({ week: weekIndex, weekday });
                        show(weekIndex, weekday);
                      }}
                      onBlur={() => setHover(null)}
                    />
                  );
                })}
              </div>
            ))}
          </fieldset>
        </div>
      </div>

      <div className="text-muted-foreground mt-2 flex items-center justify-end gap-1 text-xs">
        <span className="me-1">Less</span>
        {Array.from({ length: ACTIVITY_LEVELS + 1 }, (_level, level) => (
          <span
            // biome-ignore lint/suspicious/noArrayIndexKey: levels are positional
            key={level}
            aria-hidden
            className={cn("rounded-[2px]", LEVEL_CLASSES[level])}
            style={{ width: CELL, height: CELL }}
          />
        ))}
        <span className="ms-1">More</span>
      </div>

      {/* Fixed, not absolute: the scroller above clips anything that pokes
          out of it, and the top row's tooltip always would. */}
      {hover && hovered ? (
        <div
          role="tooltip"
          className={cn(
            "bg-foreground text-background pointer-events-none fixed z-50 -translate-y-full rounded-md px-2 py-1 text-xs whitespace-nowrap",
            // Centred over the square, except near either end of the year,
            // where centring would push it off a phone's screen.
            hover.week < 8
              ? "translate-x-0"
              : hover.week > calendar.length - 9
                ? "-translate-x-full"
                : "-translate-x-1/2",
          )}
          style={{
            left:
              hover.week < 8
                ? hover.rect.left
                : hover.week > calendar.length - 9
                  ? hover.rect.right
                  : hover.rect.left + hover.rect.width / 2,
            top: hover.rect.top - 6,
          }}
        >
          {describeDay(hovered)}
        </div>
      ) : null}
    </div>
  );
};
