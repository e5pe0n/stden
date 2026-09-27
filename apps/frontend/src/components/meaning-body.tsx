import { Loader2Icon } from "lucide-react";
import type { FC } from "react";
import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MeaningNotFoundError, useMeaning } from "@/lib/meaning";

/** A word's saved explanation, fetched when this mounts — callers render it
 *  only once the learner has asked to see the meaning. */
export const MeaningBody: FC<{ word: string }> = ({ word }) => {
  const { data, error, isLoading } = useMeaning(word);

  if (isLoading) {
    return (
      <p
        role="status"
        className="text-muted-foreground flex items-center gap-2 text-sm"
      >
        <Loader2Icon className="size-4 animate-spin" />
        Loading meaning…
      </p>
    );
  }

  if (error || data === undefined) {
    return (
      <p className="text-muted-foreground text-sm italic">
        {error instanceof MeaningNotFoundError
          ? "No saved meaning for this word."
          : "Couldn't load the meaning."}
      </p>
    );
  }

  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <Markdown remarkPlugins={[remarkGfm]}>{data}</Markdown>
    </div>
  );
};
