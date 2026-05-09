import { useDebugStore } from "@/store/debugStore";

/**
 * Intercepts console methods and global errors to feed the Diagnostic Console.
 * Only active if VITE_DEBUG_GUI=true is set in .env
 */
export function initDebugInterceptor() {
  if (import.meta.env.VITE_DEBUG_GUI !== "true") {
    return;
  }

  const originalLog = console.log;
  const originalWarn = console.warn;
  const originalError = console.error;
  const originalDebug = console.debug;

  const formatMessage = (args: any[]): string => {
    return args
      .map((a) => {
        if (typeof a === "object") {
          try {
            return JSON.stringify(a, null, 2);
          } catch {
            return "[Object]";
          }
        }
        return String(a);
      })
      .join(" ");
  };

  console.log = (...args: any[]) => {
    originalLog(...args);
    useDebugStore.getState().addLog({
      level: "info",
      source: "frontend",
      message: formatMessage(args),
      data: args.length > 1 ? args : undefined,
    });
  };

  console.warn = (...args: any[]) => {
    originalWarn(...args);
    useDebugStore.getState().addLog({
      level: "warn",
      source: "frontend",
      message: formatMessage(args),
      data: args.length > 1 ? args : undefined,
    });
  };

  console.error = (...args: any[]) => {
    originalError(...args);
    useDebugStore.getState().addLog({
      level: "error",
      source: "frontend",
      message: formatMessage(args),
      data: args.length > 1 ? args : undefined,
    });
  };

  console.debug = (...args: any[]) => {
    originalDebug(...args);
    useDebugStore.getState().addLog({
      level: "debug",
      source: "frontend",
      message: formatMessage(args),
      data: args.length > 1 ? args : undefined,
    });
  };

  // Global Error Listeners
  window.addEventListener("error", (event) => {
    useDebugStore.getState().addLog({
      level: "error",
      source: "system",
      message: `Runtime Error: ${event.message}`,
      data: {
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error,
      },
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    useDebugStore.getState().addLog({
      level: "error",
      source: "system",
      message: `Unhandled Promise Rejection: ${event.reason}`,
      data: event.reason,
    });
  });

  originalLog("🚀 Diagnostic Interceptor initialized");
}
