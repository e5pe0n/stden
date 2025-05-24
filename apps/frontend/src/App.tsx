import { useState } from "react";

function App() {
  const [messages, setMessages] = useState([
    { sender: "bot", text: "Hi! Ask me the meaning of any English word." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function fetchMeaning(word: string) {
    try {
      const res = await fetch("http://localhost:3000/api/v1", {
        method: "POST",
        body: JSON.stringify({ word }),
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
    const userMsg = { sender: "user", text: input };
    setMessages((msgs) => [...msgs, userMsg]);
    setLoading(true);
    const meaning = await fetchMeaning(input.trim());
    setMessages((msgs) => [...msgs, { sender: "bot", text: meaning }]);
    setInput("");
    setLoading(false);
  };

  return (
    <div className="max-w-md mx-auto mt-10 p-4 border rounded shadow">
      <h1 className="text-2xl font-bold mb-4">Word Meaning Chatbot</h1>
      <div className="h-64 overflow-y-auto bg-gray-50 p-2 mb-4 rounded">
        {messages.map((msg, i) => (
          <div
            key={i}
            className={
              msg.sender === "user"
                ? "text-right mb-2"
                : "text-left mb-2 text-blue-700"
            }
          >
            <span
              className={
                msg.sender === "user"
                  ? "inline-block bg-blue-100 px-3 py-1 rounded"
                  : "inline-block bg-gray-200 px-3 py-1 rounded"
              }
            >
              {msg.text}
            </span>
          </div>
        ))}
        {loading && (
          <div className="text-left text-gray-400">Bot is typing...</div>
        )}
      </div>
      <form onSubmit={handleSend} className="flex gap-2">
        <input
          className="flex-1 border rounded px-2 py-1"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type an English word..."
          disabled={loading}
        />
        <button
          className="bg-blue-500 text-white px-4 py-1 rounded disabled:opacity-50"
          type="submit"
          disabled={loading || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
}

export default App;
