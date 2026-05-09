import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./styles/globals.css";
import App from "./App";
import { initDebugInterceptor } from "./lib/debug-utils";
import { initGlobalErrorHandlers } from "./lib/error-handler";

// Initialize diagnostic interceptor
initDebugInterceptor();

// Initialize global error catching
initGlobalErrorHandlers();

const rootElement = document.getElementById("root");

if (rootElement) {
  createRoot(rootElement).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}
