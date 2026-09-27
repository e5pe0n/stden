import {
  ArrowDownIcon,
  ArrowUpIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  Loader2Icon,
  SearchIcon,
} from "lucide-react";
import { type FC, Fragment, useEffect, useId, useMemo, useState } from "react";
import { MeaningBody } from "@/components/meaning-body";
import { cn } from "@/lib/utils";
import { getLoadedWordList, loadWordList } from "@/lib/word-suggestions";
import {
  DEFAULT_DIRECTIONS,
  DIFFICULTY_LABELS,
  type Difficulty,
  FREQUENCY_LEVELS,
  filterWordRows,
  type Sort,
  type SortKey,
  sortWordRows,
  toDifficulty,
  toFrequencyBand,
  toRankIndex,
  toWordRows,
  useWords,
  type WordEntry,
  type WordRow,
} from "@/lib/words";

const DIFFICULTY_CLASSES: Record<Difficulty, string> = {
  hard: "border-destructive/30 bg-destructive/10 text-destructive",
  medium:
    "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-400",
  easy: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400",
};

/** The columns after the word, in order. Meaning isn't sortable — ordering
 *  definitions alphabetically says nothing. */
const COLUMNS: {
  key: SortKey | null;
  label: string;
  title?: string;
  numeric?: boolean;
}[] = [
  {
    key: "difficulty",
    label: "Difficulty",
    title: "How quickly you forget it, from your graded test answers",
  },
  {
    key: "frequency",
    label: "Frequency",
    title: "How common the word is in English",
  },
  { key: "asked", label: "Asked", title: "Times looked up", numeric: true },
  { key: "tested", label: "Tested", title: "Times tested", numeric: true },
  { key: "correct", label: "Correct", numeric: true },
  { key: "incorrect", label: "Incorrect", numeric: true },
  { key: null, label: "Meaning" },
];

/**
 * The corpus-frequency index, built from the autocomplete's dictionary. The
 * dictionary is its own lazy chunk; until it arrives the ranks are `null` and
 * the column says it is still loading rather than "unranked".
 */
const useRankIndex = () => {
  const [dictionary, setDictionary] = useState(getLoadedWordList);

  useEffect(() => {
    if (dictionary) return;
    let isCurrent = true;
    loadWordList().then(
      (words) => {
        if (isCurrent) setDictionary(words);
      },
      // Frequency is a nicety: without the dictionary the column stays blank.
      () => {},
    );
    return () => {
      isCurrent = false;
    };
  }, [dictionary]);

  const ranks = useMemo(
    () => (dictionary ? toRankIndex(dictionary) : null),
    [dictionary],
  );
  return { ranks, size: dictionary?.length ?? 0 };
};

export const WordsView: FC = () => {
  const { data: words, error } = useWords();

  return (
    <div className="h-full overflow-y-auto">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-6 px-4 py-8">
        <div className="space-y-1">
          <h1 className="text-xl font-medium">Words</h1>
          <p className="text-muted-foreground text-sm">
            Every word you have looked up, with how you have done on it in
            tests.
          </p>
        </div>

        {/* Cached rows win over a failed refresh, as on the Activity page. */}
        {words ? (
          <WordTable words={words} />
        ) : error ? (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive/10 text-destructive rounded-lg border px-3 py-2 text-sm"
          >
            Couldn't load your words.
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

const WordTable: FC<{ words: WordEntry[] }> = ({ words }) => {
  const { ranks, size } = useRankIndex();
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>({ key: "word", direction: "asc" });
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => toWordRows(words, ranks), [words, ranks]);
  const sorted = useMemo(() => sortWordRows(rows, sort), [rows, sort]);
  const visible = useMemo(() => filterWordRows(sorted, query), [sorted, query]);

  // A second click on the sorted column flips it; a new column starts at the
  // end that column reads best from.
  const handleSort = (key: SortKey) =>
    setSort((current) =>
      current.key === key
        ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
        : { key, direction: DEFAULT_DIRECTIONS[key] },
    );

  if (words.length === 0) {
    return (
      <p className="text-muted-foreground text-sm">
        Words you look up in Learn will show up here.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <label className="border-input focus-within:ring-ring/50 focus-within:border-ring relative flex h-9 w-full max-w-xs items-center rounded-md border focus-within:ring-[3px]">
          <span className="sr-only">Search words</span>
          <SearchIcon className="text-muted-foreground pointer-events-none absolute start-2.5 size-4" />
          <input
            type="search"
            value={query}
            placeholder="Search words"
            autoComplete="off"
            spellCheck={false}
            className="placeholder:text-muted-foreground h-full w-full bg-transparent ps-8 pe-2.5 text-sm outline-none"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <p
          className="text-muted-foreground text-sm tabular-nums"
          aria-live="polite"
        >
          {visible.length === words.length
            ? `${words.length.toLocaleString()} words`
            : `${visible.length.toLocaleString()} of ${words.length.toLocaleString()} words`}
        </p>
      </div>

      {/* A size container, so an opened meaning can be as wide as the visible
          table rather than the whole scrolling width of it. */}
      <div className="border-border @container overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="text-muted-foreground text-xs">
            <tr className="border-border border-b">
              <SortHeader
                label="Word"
                sortKey="word"
                sort={sort}
                onSort={handleSort}
                className="bg-background sticky start-0 z-10"
              />
              {COLUMNS.map((column) =>
                column.key ? (
                  <SortHeader
                    key={column.key}
                    label={column.label}
                    title={column.title}
                    sortKey={column.key}
                    sort={sort}
                    numeric={column.numeric}
                    onSort={handleSort}
                  />
                ) : (
                  <th
                    key={column.label}
                    scope="col"
                    className="px-3 py-2 text-start font-medium"
                  >
                    {column.label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td
                  colSpan={COLUMNS.length + 1}
                  className="text-muted-foreground px-3 py-6 text-center"
                >
                  No words match “{query.trim()}”.
                </td>
              </tr>
            ) : (
              visible.map((row) => (
                <WordTableRow
                  key={row.word}
                  row={row}
                  dictionarySize={size}
                  isRankLoading={ranks === null}
                  isExpanded={expanded === row.word}
                  onToggle={() =>
                    setExpanded((current) =>
                      current === row.word ? null : row.word,
                    )
                  }
                />
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const SortHeader: FC<{
  label: string;
  title?: string;
  sortKey: SortKey;
  sort: Sort;
  numeric?: boolean;
  className?: string;
  onSort: (key: SortKey) => void;
}> = ({ label, title, sortKey, sort, numeric, className, onSort }) => {
  const isActive = sort.key === sortKey;
  const Icon = !isActive
    ? ChevronsUpDownIcon
    : sort.direction === "asc"
      ? ArrowUpIcon
      : ArrowDownIcon;

  return (
    <th
      scope="col"
      aria-sort={
        isActive
          ? sort.direction === "asc"
            ? "ascending"
            : "descending"
          : undefined
      }
      className={cn("px-1 py-1 font-medium", className)}
    >
      <button
        type="button"
        title={title}
        className={cn(
          "hover:bg-foreground/5 flex w-full cursor-pointer items-center gap-1 rounded-md px-2 py-1 whitespace-nowrap",
          numeric && "justify-end",
          isActive && "text-foreground",
        )}
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon
          aria-hidden
          className={cn("size-3.5 shrink-0", !isActive && "opacity-40")}
        />
      </button>
    </th>
  );
};

const WordTableRow: FC<{
  row: WordRow;
  dictionarySize: number;
  isRankLoading: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}> = ({ row, dictionarySize, isRankLoading, isExpanded, onToggle }) => {
  const difficulty = toDifficulty(row.halfLifeDays);
  const frequency = toFrequencyBand(row.frequencyRank);
  const panelId = useId();

  return (
    <Fragment>
      <tr
        className={cn(
          "border-border border-b last:border-b-0",
          isExpanded && "border-b-0",
        )}
      >
        <th
          scope="row"
          className="bg-background sticky start-0 z-10 px-1 py-1 text-start font-medium"
        >
          <button
            type="button"
            aria-expanded={isExpanded}
            aria-controls={isExpanded ? panelId : undefined}
            className="hover:bg-foreground/5 flex cursor-pointer items-center gap-1 rounded-md px-2 py-1 whitespace-nowrap"
            onClick={onToggle}
          >
            <ChevronRightIcon
              aria-hidden
              className={cn(
                "text-muted-foreground size-3.5 shrink-0 transition-transform",
                isExpanded && "rotate-90",
              )}
            />
            {row.word}
          </button>
        </th>
        <td className="px-3 py-2">
          {difficulty ? (
            <span
              className={cn(
                "rounded border px-1.5 py-0.5 text-xs whitespace-nowrap",
                DIFFICULTY_CLASSES[difficulty],
              )}
            >
              {DIFFICULTY_LABELS[difficulty]}
            </span>
          ) : (
            <span className="text-muted-foreground text-xs">Untested</span>
          )}
        </td>
        <td
          className="px-3 py-2"
          title={
            row.frequencyRank === null
              ? undefined
              : `#${row.frequencyRank.toLocaleString()} of ${dictionarySize.toLocaleString()} words, most common first`
          }
        >
          {frequency ? (
            <span className="flex items-center gap-2 whitespace-nowrap">
              <FrequencyMeter level={frequency.level} />
              {frequency.label}
            </span>
          ) : (
            <span className="text-muted-foreground">
              {isRankLoading ? "…" : "—"}
            </span>
          )}
        </td>
        <NumberCell value={row.askedCount} />
        <NumberCell value={row.testedCount} />
        <NumberCell value={row.correctCount} />
        <NumberCell value={row.incorrectCount} />
        <td className="text-muted-foreground min-w-64 px-3 py-2">
          <span className="line-clamp-2">{row.meaning}</span>
        </td>
      </tr>
      {isExpanded ? (
        <tr className="border-border border-b last:border-b-0">
          <td
            id={panelId}
            colSpan={COLUMNS.length + 1}
            className="bg-foreground/[0.02] p-0"
          >
            {/* Pinned to the left edge and sized to the visible table, so the
                text wraps in view however far the columns are scrolled. */}
            <div className="sticky start-0 w-[100cqw] px-4 py-3">
              <MeaningBody word={row.word} />
            </div>
          </td>
        </tr>
      ) : null}
    </Fragment>
  );
};

const NumberCell: FC<{ value: number }> = ({ value }) => (
  <td
    className={cn(
      "px-3 py-2 text-end tabular-nums",
      value === 0 && "text-muted-foreground",
    )}
  >
    {value.toLocaleString()}
  </td>
);

/** Rising bars, like a signal meter: the more filled, the more common. */
const FrequencyMeter: FC<{ level: number }> = ({ level }) => (
  <span aria-hidden className="flex h-3 items-end gap-px">
    {Array.from({ length: FREQUENCY_LEVELS }, (_bar, index) => (
      <span
        // biome-ignore lint/suspicious/noArrayIndexKey: bars are positional
        key={index}
        className={cn(
          "w-[3px] rounded-[1px]",
          index < level ? "bg-foreground/70" : "bg-foreground/15",
        )}
        style={{ height: `${((index + 1) / FREQUENCY_LEVELS) * 100}%` }}
      />
    ))}
  </span>
);
