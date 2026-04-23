import { toast } from "sonner";

/**
 * Global Error Handler for LogLensAi
 * Captures unhandled promise rejections and window errors to inform the user via Toasts.
 */
export function initGlobalErrorHandlers() {
  if (typeof window === "undefined") {
    return;
  }

  // Handle unhandled runtime errors
  window.onerror = (message, source, lineno, colno, error) => {
    console.error("[Global Error]", { message, source, lineno, colno, error });

    // Avoid double toasting for already handled sidecar errors
    if (String(message).includes("Sidecar Error") || String(message).includes("Connection Error")) {
      return;
    }

    toast.error("Runtime Error", {
      description:
        typeof message === "string" ? message : "An unexpected application error occurred.",
    });
  };

  // Handle unhandled promise rejections (async/await)
  window.onunhandledrejection = (event) => {
    console.error("[Unhandled Rejection]", event.reason);

    const message = event.reason instanceof Error ? event.reason.message : String(event.reason);

    // Avoid double toasting for already handled sidecar errors
    if (message.includes("Sidecar Error") || message.includes("Connection Error")) {
      return;
    }

    toast.error("Async Error", {
      description: message || "An unhandled promise rejection occurred.",
    });
  };

  console.log("[LogLensAi] Global error handlers initialized.");
}
