import {
  GraduationCapIcon,
  Loader2Icon,
  PlusIcon,
  SidebarIcon,
  SquareCheckBigIcon,
  TrashIcon,
} from "lucide-react";
import type { FC, ReactNode } from "react";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import type { Feature } from "@/lib/feature";
import { formatHistoryTime } from "@/lib/history";
import { cn } from "@/lib/utils";

/**
 * One row of whichever list the sidebar is showing. Both features reduce to
 * this shape, so the list below the feature section stays one component
 * instead of two that drift apart.
 */
export type SidebarItem = {
  id: number;
  title: string;
  /** A short tag beside the timestamp — an ask mode, or a test score. */
  badge: string | null;
  createdAt: string;
};

const FEATURE_BUTTONS: {
  feature: Feature;
  label: string;
  icon: ReactNode;
}[] = [
  { feature: "learn", label: "Learn", icon: <GraduationCapIcon /> },
  { feature: "test", label: "Test", icon: <SquareCheckBigIcon /> },
];

type AppSidebarProps = {
  feature: Feature;
  onFeatureChange: (feature: Feature) => void;
  items: readonly SidebarItem[];
  activeId: number | null;
  /** The row whose body is being fetched, if any. */
  pendingId: number | null;
  isLoading: boolean;
  error: string | null;
  /** Shown in place of the list when there is nothing to list yet. */
  emptyMessage: string;
  newLabel: string;
  isOpen: boolean;
  onToggle: () => void;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onNew: () => void;
};

export const AppSidebar: FC<AppSidebarProps> = ({
  feature,
  onFeatureChange,
  items,
  activeId,
  pendingId,
  isLoading,
  error,
  emptyMessage,
  newLabel,
  isOpen,
  onToggle,
  onSelect,
  onDelete,
  onNew,
}) => {
  return (
    <>
      {/* Below `md` the sidebar floats over the main pane, so it needs a
          backdrop to dismiss. Above it, the sidebar sits in the flex row and
          this is inert. */}
      {isOpen ? (
        <button
          type="button"
          aria-label="Close sidebar"
          tabIndex={-1}
          className="fixed inset-0 z-20 bg-black/40 md:hidden"
          onClick={onToggle}
        />
      ) : null}

      <aside
        data-slot="app-sidebar"
        aria-label="Sidebar"
        aria-hidden={!isOpen}
        inert={!isOpen}
        className={cn(
          "bg-sidebar text-sidebar-foreground border-sidebar-border z-30 flex h-dvh w-64 shrink-0 flex-col border-e transition-[margin,transform] duration-200",
          "max-md:fixed max-md:inset-y-0 max-md:start-0",
          isOpen ? "max-md:translate-x-0" : "-ms-64 max-md:-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between gap-1 p-2">
          <TooltipIconButton tooltip="Hide sidebar" onClick={onToggle}>
            <SidebarIcon />
          </TooltipIconButton>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={onNew}
          >
            <PlusIcon className="size-4" />
            {newLabel}
          </Button>
        </div>

        {/* Which feature the app is in — and, because the list below follows
            it, which history the sidebar is listing. */}
        <fieldset className="bg-foreground/5 relative mx-2 mb-2 grid grid-cols-2 gap-1 rounded-lg p-1">
          <legend className="sr-only">Feature</legend>
          {FEATURE_BUTTONS.map(({ feature: candidate, label, icon }) => (
            <Button
              key={candidate}
              variant="ghost"
              size="sm"
              aria-pressed={candidate === feature}
              className={cn(
                "gap-1.5",
                candidate === feature
                  ? "bg-background text-foreground shadow-xs hover:bg-background"
                  : "text-muted-foreground",
              )}
              onClick={() => onFeatureChange(candidate)}
            >
              {icon}
              {label}
            </Button>
          ))}
        </fieldset>

        <nav
          aria-label={feature === "learn" ? "Ask history" : "Test history"}
          className="flex-1 overflow-y-auto px-2 pb-2"
        >
          {/* A banner above the list, never in place of it: a failed delete
              rolls its row back, and blanking the list would hide it. */}
          {error ? (
            <p role="alert" className="text-destructive px-2 py-1.5 text-sm">
              {error}
            </p>
          ) : null}

          {isLoading ? (
            <p className="text-muted-foreground px-2 py-1.5 text-sm">
              Loading…
            </p>
          ) : items.length === 0 ? (
            error ? null : (
              <p className="text-muted-foreground px-2 py-1.5 text-sm">
                {emptyMessage}
              </p>
            )
          ) : (
            <ul className="flex flex-col gap-0.5">
              {items.map((item) => (
                <SidebarRow
                  key={item.id}
                  item={item}
                  isActive={item.id === activeId}
                  isPending={item.id === pendingId}
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

type SidebarRowProps = {
  item: SidebarItem;
  isActive: boolean;
  isPending: boolean;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
};

const SidebarRow: FC<SidebarRowProps> = ({
  item,
  isActive,
  isPending,
  onSelect,
  onDelete,
}) => {
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
        onClick={() => onSelect(item.id)}
      >
        <span className="block truncate text-sm">{item.title}</span>
        <span className="text-muted-foreground mt-0.5 flex items-center gap-1.5 text-xs">
          {item.badge ? (
            <span className="border-border rounded border px-1 leading-4">
              {item.badge}
            </span>
          ) : null}
          <span>{formatHistoryTime(item.createdAt)}</span>
        </span>
      </button>

      <span className="absolute end-1 top-1.5">
        {isPending ? (
          <Loader2Icon className="text-muted-foreground m-1.5 size-4 animate-spin" />
        ) : (
          <TooltipIconButton
            tooltip="Delete"
            className="opacity-50 transition-opacity hover:opacity-100 focus-visible:opacity-100 group-hover/row:opacity-100"
            onClick={() => onDelete(item.id)}
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
 * is a row above the main pane rather than an overlay so it never covers
 * content.
 */
export const AppSidebarTrigger: FC<{ onToggle: () => void }> = ({
  onToggle,
}) => {
  return (
    <div className="flex shrink-0 items-center p-2">
      <TooltipIconButton tooltip="Show sidebar" onClick={onToggle}>
        <SidebarIcon />
      </TooltipIconButton>
    </div>
  );
};
