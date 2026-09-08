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
import { Thread } from "@/components/assistant-ui/thread";
import {
  HistorySidebar,
  HistorySidebarTrigger,
} from "@/components/history-sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { parseAskPayload } from "@/lib/ask";
import {
  askResponseSchema,
  deleteHistory,
  fetchHistories,
  fetchHistory,
  type HistoryEntry,
  type HistorySummary,
} from "@/lib/history";
import { config } from "./config";

const GREETING: ThreadMessageLike = {
  role: "assistant",
  content: [
    { type: "text", text: "Hi! Ask me the meaning of any English word." },
  ],
};

const FALLBACK_ANSWER = "Sorry, I couldn't find the meaning.";

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
 * What the thread is showing. `key` changes on every navigation — including
 * reopening the entry already on screen — so the runtime always remounts with
 * the messages below rather than keeping whatever the last thread accumulated.
 */
type Session = {
  key: number;
  entry: HistoryEntry | null;
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

function App() {
  const isDesktop = useIsDesktop();
  const [histories, setHistories] = useState<readonly HistorySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [session, setSession] = useState<Session>({ key: 0, entry: null });
  // Two flags rather than one, because the default differs by breakpoint: the
  // sidebar is part of the desktop layout but a drawer over the thread on a
  // phone. Sampling one flag at mount would strand it on the wrong default
  // after a resize or rotation.
  const [isDesktopOpen, setIsDesktopOpen] = useState(true);
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isSidebarOpen = isDesktop ? isDesktopOpen : isMobileOpen;

  useEffect(() => {
    const controller = new AbortController();

    fetchHistories(controller.signal)
      .then((loaded) => {
        if (controller.signal.aborted) return;
        setHistories(loaded);
        setIsLoading(false);
      })
      .catch(() => {
        if (controller.signal.aborted) return;
        setError("Couldn't load history.");
        setIsLoading(false);
      });

    return () => controller.abort();
  }, []);

  // Picking an entry on a phone means reading it, not staying in the list.
  // On desktop the drawer flag is already false and this changes nothing.
  const leaveSidebar = useCallback(() => setIsMobileOpen(false), []);

  const handleRecorded = useCallback((history: HistorySummary) => {
    setHistories((current) => [history, ...current]);
    setActiveId(history.id);
  }, []);

  const handleSelect = useCallback(
    async (id: number) => {
      setPendingId(id);
      setError(null);
      try {
        const entry = await fetchHistory(id);
        setSession((current) => ({ key: current.key + 1, entry }));
        setActiveId(id);
        setError(null);
        leaveSidebar();
      } catch {
        setError("Couldn't open that entry.");
      } finally {
        setPendingId(null);
      }
    },
    [leaveSidebar],
  );

  const handleNew = useCallback(() => {
    setSession((current) => ({ key: current.key + 1, entry: null }));
    setActiveId(null);
    leaveSidebar();
  }, [leaveSidebar]);

  // Optimistic: the row disappears at once and comes back if the write fails.
  const handleDelete = useCallback(
    async (id: number) => {
      const previous = histories;
      setHistories((current) => current.filter((history) => history.id !== id));
      setActiveId((current) => (current === id ? null : current));
      setError(null);

      try {
        await deleteHistory(id);
      } catch {
        setHistories(previous);
        setError("Couldn't delete that entry.");
      }
    },
    [histories],
  );

  const toggleSidebar = useCallback(() => {
    const setOpen = isDesktop ? setIsDesktopOpen : setIsMobileOpen;
    setOpen((open) => !open);
  }, [isDesktop]);

  return (
    <TooltipProvider>
      <div className="bg-background flex h-dvh">
        <HistorySidebar
          histories={histories}
          activeId={activeId}
          pendingId={pendingId}
          isLoading={isLoading}
          error={error}
          isOpen={isSidebarOpen}
          onToggle={toggleSidebar}
          onSelect={handleSelect}
          onDelete={handleDelete}
          onNew={handleNew}
        />

        <main className="flex min-w-0 flex-1 flex-col">
          {isSidebarOpen ? null : (
            <HistorySidebarTrigger onToggle={toggleSidebar} />
          )}
          <div className="min-h-0 flex-1">
            <ChatSession
              key={session.key}
              entry={session.entry}
              onRecorded={handleRecorded}
            />
          </div>
        </main>
      </div>
    </TooltipProvider>
  );
}

export default App;
