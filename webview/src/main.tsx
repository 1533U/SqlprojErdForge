import { createRoot } from "react-dom/client";
import { App } from "./App";
import "./styles.css";

const root = document.getElementById("root");
if (!root) {
  throw new Error("Missing #root element");
}

try {
  createRoot(root).render(<App />);
} catch (err) {
  const message = err instanceof Error ? err.message : String(err);
  root.textContent = `ErdForge webview failed to start: ${message}`;
}
