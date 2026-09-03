import {
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  useLocalRuntime,
} from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { TooltipProvider } from "@/components/ui/tooltip";
import { config } from "./config";

type AskPayload =
  | { type: "meaning"; input: string; regenerate?: boolean }
  | { type: "diff"; input: string[] }
  | { type: "free"; input: string };

function parseAskPayload(rawText: string): AskPayload | null {
  const text = rawText.trim();
  if (!text) return null;

  const slashMatch = text.match(/^\/(meaning|diff|free)\s+(.*)$/i);
  if (!slashMatch) {
    return { type: "meaning", input: text };
  }

  const mode = slashMatch[1].toLowerCase() as "meaning" | "diff" | "free";
  const rest = slashMatch[2].trim();
  if (!rest) return null;

  if (mode === "diff") {
    const words = rest
      .split(/,|\n|\s+vs\s+/i)
      .map((word) => word.trim())
      .filter(Boolean);

    if (words.length < 2) return null;
    return {
      type: "diff",
      input: words,
    };
  }

  return {
    type: mode,
    input: rest,
  };
}

const dictionaryAdapter: ChatModelAdapter = {
  async run({ messages, abortSignal, runConfig }) {
    const userMessages = messages.filter((message) => message.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastUserText =
      lastUserMessage?.content
        .filter((part) => part.type === "text")
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("\n") ?? "";

    const payload = parseAskPayload(lastUserText);

    // The refresh button reloads with `custom.regenerate`, signaling the backend
    // to bypass the cached meaning and generate fresh content.
    if (payload?.type === "meaning" && runConfig?.custom?.regenerate === true) {
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
          content: [
            { type: "text", text: "Sorry, I couldn't find the meaning." },
          ],
        };
      }

      const data = (await response.json()) as { text?: string };
      return {
        content: [
          {
            type: "text",
            text: data.text || "Sorry, I couldn't find the meaning.",
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
};

function App() {
  const runtime = useLocalRuntime(dictionaryAdapter, {
    initialMessages: [
      {
        role: "assistant",
        content: [
          { type: "text", text: "Hi! Ask me the meaning of any English word." },
        ],
      },
    ],
  });

  return (
    <TooltipProvider>
      <AssistantRuntimeProvider runtime={runtime}>
        <main className="h-dvh bg-background">
          <Thread />
        </main>
      </AssistantRuntimeProvider>
    </TooltipProvider>
  );
}

export default App;
