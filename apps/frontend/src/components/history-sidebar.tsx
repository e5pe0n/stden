import { Loader2Icon, PlusIcon, SidebarIcon, TrashIcon } from "lucide-react";
import type { FC } from "react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import type { AskType } from "@/lib/ask";
import { formatHistoryTime, type HistorySummary } from "@/lib/history";
import { cn } from "@/lib/utils";

/** A word lookup is the default mode, so only the slash modes earn a label. */
const ASK_TYPE_LABELS: Record<AskType, string | null> = {
  meaning: null,
  diff: "diff",
  free: "free",
};

type HistorySidebarProps = {
  histories: readonly HistorySummary[];
  activeId: number | null;
  /** The row whose answer is being fetched, if any. */
  pendingId: number | null;
  isLoading: boolean;
  error: string | null;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onNew: () => void;
};

export const HistorySidebar: FC<HistorySidebarProps> = ({
  histories,
  activeId,
  pendingId,
  isLoading,
  error,
  isOpen,
  onToggle,
  onSelect,
  onDelete,
  onNew,
}) => {
  return (
    <>
      {/* Below `md` the sidebar floats over the thread, so it needs a backdrop
          to dismiss. Above it, the sidebar sits in the flex row and this is
          inert. */}
      {isOpen ? (
        <button
          type="button"
          aria-label="Close history"
          tabIndex={-1}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onToggle}
        />
      ) : null}

      <aside
        data-slot="history-sidebar"
        aria-label="History"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border z-30 flex h-dvh w-64 shrink-0 flex-col border-e transition-[margin,transform] duration-200",
          "max-md:fixed max-md:inset-y-0 max-md:start-0",
          isOpen ? "max-md:translate-x-0" : "-ms-64 max-md:-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-1 p-2">
          <TooltipIconButton tooltip="Hide history" onClick={onToggle}>
            <SidebarIcon />
          </TooltipIconButton>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onNew}
          >
            <PlusIcon className="size-4" />
            New
          </Button>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 pb-2">
          {/* A banner above the list, never in place of it: a failed delete
              rolls its row back, and blanking the history would hide it. */}
          {error ? (
            <p role="alert" className="text-destructive px-2 py-1.5 text-sm">
              {error}
            </p>
          ) : null}

          {isLoading ? (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">
              Loading…
            </p>
          ) : histories.length === 0 ? (
            error ? null : (
              <p className="text-muted-foreground px-2 py-1.5 text-sm">
                Your lookups will show up here.
              </p>
            )
          ) : (
            <ul className="flex flex-col gap-0.5">
              {histories.map((history) => (
                <HistoryRow
                  key={history.id}
                  history={history}
                  isActive={history.id === activeId}
                  isPending={history.id === pendingId}
                  onSelect={onSelect}
                  onDelete={onDelete}
                />
              ))}
            </ul>
          )}
        </nav>
      </aside>
    </>
  );
};

type HistoryRowProps = {
  history: HistorySummary;
  isActive: boolean;
  isPending: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
};

const HistoryRow: FC<HistoryRowProps> = ({
  history,
  isActive,
  isPending,
  onSelect,
  onDelete,
}) => {
  const label = ASK_TYPE_LABELS[history.type];

  return (
    <li className="group/row relative">
      <button
        type="button"
        aria-current={isActive ? "true" : undefined}
        // Tinting with the foreground rather than `--sidebar-accent`: in the
        // light theme that token sits at oklch(0.97) against a sidebar of
        // oklch(0.985), a difference too small to register as feedback. An
        // alpha over the foreground stays legible in both themes.
        className={cn(
          "w-full cursor-pointer rounded-md px-2 py-1.5 pe-8 text-start transition-colors",
          isActive ? "bg-foreground/10 font-medium" : "hover:bg-foreground/5",
        )}
        onClick={() => onSelect(history.id)}
      >
        <span className="block truncate text-sm">{history.question}</span>
        <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
          {label ? (
            <span className="border-border rounded border px-1 leading-4">
              {label}
            </span>
          ) : null}
          <span>{formatHistoryTime(history.createdAt)}</span>
        </span>
      </button>

      <span className="absolute end-1 top-1.5">
        {isPending ? (
          <Loader2Icon className="text-muted-foreground m-1.5 size-4 animate-spin" />
        ) : (
          <TooltipIconButton
            tooltip="Delete"
            className="opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover/row:opacity-100"
            onClick={() => onDelete(history.id)}
          >
            <TrashIcon />
          </TooltipIconButton>
        )}
      </span>
    </li>
  );
};

/**
 * Reopens the sidebar once it is hidden and the toggle inside it is gone. It
 * is a row above the thread rather than an overlay so it never covers a
 * message.
 */
export const HistorySidebarTrigger: FC<{ onToggle: () => void }> = ({
  onToggle,
}) => {
  return (
    <div className="flex shrink-0 items-center p-2">
      <TooltipIconButton tooltip="Show history" onClick={onToggle}>
        <SidebarIcon />
      </TooltipIconButton>
    </div>
  );
};
