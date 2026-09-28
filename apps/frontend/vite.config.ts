import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";

// Use a blue favicon on the dev server to tell local tabs apart from production.
const devFavicon = (): Plugin => ({
  name: "dev-favicon",
  apply: "serve",
  transformIndexHtml: (html) =>
    html.replace("/notebook-svgrepo-com.svg", "/notebook-svgrepo-com-dev.svg"),
});

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), devFavicon()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: true, // needed for Docker
  },
});
