import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { config } from "./config.ts";

async function enableMocking() {
  if (config.mswEnabled) {
    const { worker } = await import("../mocks/browser.ts");
    worker.start();
  }
}

enableMocking().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
