import {
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  type ThreadMessageLike,
  useLocalRuntime,
} from "@assistant-ui/react";
import {
  type FC,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AppSidebar,
  AppSidebarTrigger,
  type SidebarItem,
} from "@/components/app-sidebar";
import { Thread } from "@/components/assistant-ui/thread";
import { TestView } from "@/components/test-view";
import { TooltipProvider } from "@/components/ui/tooltip";
import { type AskType, parseAskPayload } from "@/lib/ask";
import type { Feature } from "@/lib/feature";
import {
  askResponseSchema,
  deleteHistory,
  fetchHistories,
  fetchHistory,
  type HistoryEntry,
  type HistorySummary,
} from "@/lib/history";
import {
  deleteTest,
  fetchTest,
  fetchTests,
  type TestEntry,
  type TestSummary,
  toTestSummary,
} from "@/lib/test";
import { config } from "./config";

const GREETING: ThreadMessageLike = {
  role: "assistant",
  content: [
    { type: "text", text: "Hi! Ask me the meaning of any English word." },
  ],
};

const FALLBACK_ANSWER = "Sorry, I couldn't find the meaning.";

/** A word lookup is the default mode, so only the slash modes earn a label. */
const ASK_TYPE_LABELS: Record<AskType, string | null> = {
  meaning: null,
  diff: "diff",
  free: "free",
};

/** Matches the `md` breakpoint the sidebar's own classes switch on. */
const DESKTOP_QUERY = "(min-width: 48rem)";

const useIsDesktop = (): boolean => {
  const [isDesktop, setIsDesktop] = useState(
    () => window.matchMedia(DESKTOP_QUERY).matches,
  );

  useEffect(() => {
    const query = window.matchMedia(DESKTOP_QUERY);
    const onChange = () => setIsDesktop(query.matches);
    query.addEventListener("change", onChange);
    return () => query.removeEventListener("change", onChange);
  }, []);

  return isDesktop;
};

/**
 * What the main pane is showing. `key` changes on every navigation —
 * including reopening the entry already on screen — so the view always
 * remounts from the entry below rather than keeping whatever state the last
 * one accumulated.
 */
type Session<T> = {
  key: number;
  entry: T | null;
};

const toInitialMessages = (entry: HistoryEntry | null): ThreadMessageLike[] =>
  entry === null
    ? [GREETING]
    : [
        { role: "user", content: [{ type: "text", text: entry.question }] },
        { role: "assistant", content: [{ type: "text", text: entry.answer }] },
      ];

type ChatSessionProps = {
  entry: HistoryEntry | null;
  onRecorded: (history: HistorySummary) => void;
};

const ChatSession: FC<ChatSessionProps> = ({ entry, onRecorded }) => {
  // The adapter is built once per session; a ref keeps it from going stale
  // when the parent re-renders with a new callback identity.
  const onRecordedRef = useRef(onRecorded);
  useEffect(() => {
    onRecordedRef.current = onRecorded;
  });

  const adapter = useMemo<ChatModelAdapter>(
    () => ({
      async run({ messages, abortSignal, runConfig }) {
        const userMessages = messages.filter(
          (message) => message.role === "user",
        );
        const lastUserMessage = userMessages[userMessages.length - 1];
        const lastUserText =
          lastUserMessage?.content
            .filter((part) => part.type === "text")
            .map((part) => (part.type === "text" ? part.text : ""))
            .join("\n") ?? "";

        const payload = parseAskPayload(lastUserText);

        // The refresh button reloads with `custom.regenerate`, signaling the
        // backend to bypass the cached meaning and generate fresh content.
        if (
          payload?.type === "meaning" &&
          runConfig?.custom?.regenerate === true
        ) {
          payload.regenerate = true;
        }

        if (!payload) {
          return {
            content: [
              {
                type: "text",
                text: "Please enter text. For /diff, provide at least two words (for example: /diff affect, effect).",
              },
            ],
          };
        }

        try {
          const response = await fetch(config.backendApiEndpoint, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify(payload),
            signal: abortSignal,
          });

          if (!response.ok) {
            return {
              content: [{ type: "text", text: FALLBACK_ANSWER }],
            };
          }

          const data = askResponseSchema.parse(await response.json());
          if (data.history) onRecordedRef.current(data.history);

          return {
            content: [
              {
                type: "text",
                text: data.text || FALLBACK_ANSWER,
              },
            ],
          };
        } catch (error) {
          if (error instanceof Error && error.name === "AbortError") {
            throw error;
          }

          return {
            content: [{ type: "text", text: "Sorry, something went wrong." }],
          };
        }
      },
    }),
    [],
  );

  const runtime = useLocalRuntime(adapter, {
    initialMessages: toInitialMessages(entry),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <Thread />
    </AssistantRuntimeProvider>
  );
};

const toHistoryItem = (history: HistorySummary): SidebarItem => ({
  id: history.id,
  title: history.question,
  badge: ASK_TYPE_LABELS[history.type],
  createdAt: history.createdAt,
});

/** The words stand in for a title: no two test sets read the same. */
const toTestItem = (test: TestSummary): SidebarItem => ({
  id: test.id,
  title: test.words.join(", "),
  badge: `${test.score}/100`,
  createdAt: test.createdAt,
});

function App() {
  const isDesktop = useIsDesktop();
  const [feature, setFeature] = useState<Feature>("learn");

  const [histories, setHistories] = useState<readonly HistorySummary[]>([]);
  const [tests, setTests] = useState<readonly TestSummary[]>([]);
  // Each feature tracks its own list, selection and errors, so switching back
  // and forth returns to what was on screen instead of resetting it.
  const [isLoading, setIsLoading] = useState<Record<Feature, boolean>>({
    learn: true,
    test: true,
  });
  const [errors, setErrors] = useState<Record<Feature, string | null>>({
    learn: null,
    test: null,
  });
  const [activeIds, setActiveIds] = useState<Record<Feature, number | null>>({
    learn: null,
    test: null,
  });
  const [pendingId, setPendingId] = useState<number | null>(null);

  const [chat, setChat] = useState<Session<HistoryEntry>>({
    key: 0,
    entry: null,
  });
  const [test, setTest] = useState<Session<TestEntry>>({
    key: 0,
    entry: null,
  });

  // Two flags rather than one, because the default differs by breakpoint: the
  // sidebar is part of the desktop layout but a drawer over the main pane on a
  // phone. Sampling one flag at mount would strand it on the wrong default
  // after a resize or rotation.
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isSidebarOpen = isDesktop ? isDesktopOpen : isMobileOpen;

  const setError = useCallback((target: Feature, message: string | null) => {
    setErrors((current) => ({ ...current, [target]: message }));
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    const load = <T,>(
      target: Feature,
      fetcher: (signal: AbortSignal) => Promise<T>,
      apply: (loaded: T) => void,
      message: string,
    ) =>
      fetcher(controller.signal)
        .then((loaded) => {
          if (controller.signal.aborted) return;
          apply(loaded);
          setIsLoading((current) => ({ ...current, [target]: false }));
        })
        .catch(() => {
          if (controller.signal.aborted) return;
          setErrors((current) => ({ ...current, [target]: message }));
          setIsLoading((current) => ({ ...current, [target]: false }));
        });

    load("learn", fetchHistories, setHistories, "Couldn't load history.");
    load("test", fetchTests, setTests, "Couldn't load past tests.");

    return () => controller.abort();
  }, []);

  // Picking an entry on a phone means reading it, not staying in the list.
  // On desktop the drawer flag is already false and this changes nothing.
  const leaveSidebar = useCallback(() => setIsMobileOpen(false), []);

  const handleRecorded = useCallback((history: HistorySummary) => {
    setHistories((current) => [history, ...current]);
    setActiveIds((current) => ({ ...current, learn: history.id }));
  }, []);

  const handleCompleted = useCallback((entry: TestEntry) => {
    const summary = toTestSummary(entry);
    setTests((current) => [summary, ...current]);
    setActiveIds((current) => ({ ...current, test: summary.id }));
  }, []);

  const handleSelect = useCallback(
    async (id: number) => {
      setPendingId(id);
      setError(feature, null);
      try {
        if (feature === "learn") {
          const entry = await fetchHistory(id);
          setChat((current) => ({ key: current.key + 1, entry }));
        } else {
          const entry = await fetchTest(id);
          setTest((current) => ({ key: current.key + 1, entry }));
        }
        setActiveIds((current) => ({ ...current, [feature]: id }));
        leaveSidebar();
      } catch {
        setError(feature, "Couldn't open that entry.");
      } finally {
        setPendingId(null);
      }
    },
    [feature, leaveSidebar, setError],
  );

  const handleNew = useCallback(() => {
    if (feature === "learn") {
      setChat((current) => ({ key: current.key + 1, entry: null }));
    } else {
      setTest((current) => ({ key: current.key + 1, entry: null }));
    }
    setActiveIds((current) => ({ ...current, [feature]: null }));
    leaveSidebar();
  }, [feature, leaveSidebar]);

  // Optimistic: the row disappears at once and comes back if the write fails.
  const handleDelete = useCallback(
    async (id: number) => {
      const previousHistories = histories;
      const previousTests = tests;

      if (feature === "learn") {
        setHistories((current) => current.filter((row) => row.id !== id));
      } else {
        setTests((current) => current.filter((row) => row.id !== id));
      }
      setActiveIds((current) =>
        current[feature] === id ? { ...current, [feature]: null } : current,
      );
      setError(feature, null);

      try {
        await (feature === "learn" ? deleteHistory(id) : deleteTest(id));
      } catch {
        setHistories(previousHistories);
        setTests(previousTests);
        setError(feature, "Couldn't delete that entry.");
      }
    },
    [feature, histories, tests, setError],
  );

  const toggleSidebar = useCallback(() => {
    const setOpen = isDesktop ? setIsDesktopOpen : setIsMobileOpen;
    setOpen((open) => !open);
  }, [isDesktop]);

  const items = useMemo(
    () =>
      feature === "learn"
        ? histories.map(toHistoryItem)
        : tests.map(toTestItem),
    [feature, histories, tests],
  );

  return (
    <TooltipProvider>
      {/* `overflow-hidden` keeps this a fixed frame: both panes scroll on
          their own, and a stray absolutely-positioned child must never give
          the document a second scrollbar of its own. */}
      <div className="bg-background flex h-dvh overflow-hidden">
        <AppSidebar
          feature={feature}
          onFeatureChange={setFeature}
          items={items}
          activeId={activeIds[feature]}
          pendingId={pendingId}
          isLoading={isLoading[feature]}
          error={errors[feature]}
          emptyMessage={
            feature === "learn"
              ? "Your lookups will show up here."
              : "Your tests will show up here."
          }
          newLabel={feature === "learn" ? "New" : "New test"}
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onNew={handleNew}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {isSidebarOpen ? null : (
            <AppSidebarTrigger onToggle={toggleSidebar} />
          )}
          <div className="min-h-0 flex-1">
            {feature === "learn" ? (
              <ChatSession
                key={chat.key}
                entry={chat.entry}
                onRecorded={handleRecorded}
              />
            ) : (
              <TestView
                key={test.key}
                initialTest={test.entry}
                onCompleted={handleCompleted}
              />
            )}
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;
