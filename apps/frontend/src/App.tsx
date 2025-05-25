import { useState, useRef, useEffect } from "react";

function App() {
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "Hi! Ask me the meaning of any English word.",
      id: "welcome",
    },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  async function fetchMeaning(text: string) {
    try {
      const res = await fetch("http://localhost:3000/api/v1", {
        method: "PUT",
        body: JSON.stringify({ text }),
      });
      if (!res.ok) return "Sorry, I couldn't find the meaning.";
      const data = await res.json();
      return data.text || "Sorry, I couldn't find the meaning.";
    } catch {
      return "Sorry, something went wrong.";
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    const userMsg = {
      sender: "user",
      text: input,
      id: `user-${Date.now()}`,
    };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    const meaning = await fetchMeaning(input.trim());
    setMessages((msgs) => [
      ...msgs,
      {
        sender: "bot",
        text: meaning,
        id: `bot-${Date.now()}`,
      },
    ]);
    setInput("");
    setLoading(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 p-4">
        <h1 className="text-xl font-semibold text-center text-gray-800">
          Dictionary Chat
        </h1>
      </header>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${
              msg.sender === "user" ? "justify-end" : "justify-start"
            }`}
          >
            <div
              className={`max-w-[80%] px-4 py-3 rounded-lg ${
                msg.sender === "user"
                  ? "bg-blue-600 text-white rounded-br-none"
                  : "bg-gray-200 text-gray-800 rounded-bl-none"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-200 text-gray-800 px-4 py-3 rounded-lg rounded-bl-none max-w-[80%]">
              <div className="flex space-x-2">
                <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" />
                <div
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.2s" }}
                />
                <div
                  className="w-2 h-2 bg-gray-500 rounded-full animate-bounce"
                  style={{ animationDelay: "0.4s" }}
                />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input area */}
      <div className="bg-white border-t border-gray-200 p-4">
        <form
          onSubmit={handleSend}
          className="flex space-x-2 max-w-4xl mx-auto"
        >
          <input
            className="flex-1 border border-gray-300 rounded-md px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type an English word..."
            disabled={loading}
          />
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            type="submit"
            disabled={loading || !input.trim()}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}

export default App;
