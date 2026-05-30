import {
  AssistantRuntimeProvider,
  type ChatModelAdapter,
  useLocalRuntime,
} from "@assistant-ui/react";
import { Thread } from "@/components/assistant-ui/thread";
import { TooltipProvider } from "@/components/ui/tooltip";
import { config } from "./config";

const dictionaryAdapter: ChatModelAdapter = {
  async run({ messages, abortSignal }) {
    const userMessages = messages.filter((message) => message.role === "user");
    const lastUserMessage = userMessages[userMessages.length - 1];
    const lastUserText =
      lastUserMessage?.content
        .filter((part) => part.type === "text")
        .map((part) => (part.type === "text" ? part.text : ""))
        .join("\n") ?? "";

    if (!lastUserText.trim()) {
      return {
        content: [{ type: "text", text: "Please type a word to get started." }],
      };
    }

    try {
      const response = await fetch(config.backendApiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ text: lastUserText }),
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
