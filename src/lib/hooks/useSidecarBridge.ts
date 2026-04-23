export interface SidecarRequest {
  method: string;
  params?: Record<string, unknown>;
}

export interface SidecarResponse<T> {
  jsonrpc: string;
  id: string | number | null;
  result?: T;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Detects whether the app is running inside a Tauri desktop shell.
 * When false, the app is running as a standalone web app in a browser.
 */
function isTauriRuntime(): boolean {
  return typeof globalThis !== "undefined" && "__TAURI_INTERNALS__" in globalThis;
}

/**
 * The sidecar HTTP endpoint for web mode.
 * Configurable via VITE_SIDECAR_URL env variable, defaults to localhost:4001.
 */
export const SIDECAR_BASE_URL = import.meta.env.VITE_SIDECAR_URL || "http://localhost:5000";
console.log("[LogLensAi] Sidecar URL resolved to:", SIDECAR_BASE_URL);
export const SIDECAR_URL = `${SIDECAR_BASE_URL}/rpc`;

import { toast } from "sonner";

/**
 * Dispatches a JSON-RPC request to the Python sidecar.
 *
 * - **Desktop mode (Tauri)**: Routes via the Rust bridge using `invoke("dispatch_sidecar")`.
 * - **Web mode (Browser)**: Routes directly to the sidecar HTTP endpoint via `fetch()`.
 *
 * The transport is selected automatically at runtime based on the presence of
 * Tauri internals, or can be forced to web mode via `VITE_APP_MODE=web`.
 */
export async function callSidecar<T>(request: SidecarRequest): Promise<T> {
  const rpcReq = {
    jsonrpc: "2.0",
    id: Math.floor(Math.random() * 10000),
    method: request.method,
    params: request.params ?? {},
  };

  // Explicit override: VITE_APP_MODE=web forces web transport
  const forceWeb = import.meta.env.VITE_APP_MODE === "web";

  try {
    let response: SidecarResponse<T>;

    if (!forceWeb && isTauriRuntime()) {
      // Desktop mode: route through Tauri Rust bridge → HTTP → Python
      const { invoke } = await import("@tauri-apps/api/core");
      const responseStr = await invoke<string>("dispatch_sidecar", {
        request: JSON.stringify(rpcReq),
      });
      response = JSON.parse(responseStr);
    } else {
      // Web mode: call sidecar HTTP endpoint directly
      const httpResp = await fetch(SIDECAR_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(rpcReq),
      });

      if (!httpResp.ok) {
        throw new Error(`Sidecar HTTP Error: ${httpResp.status} ${httpResp.statusText}`);
      }

      response = await httpResp.json();
    }

    if (response.error) {
      const detail = response.error.data
        ? `\n\nDetail:\n${typeof response.error.data === "string" ? response.error.data : JSON.stringify(response.error.data, null, 2)}`
        : "";
      const errorMsg = (response.error.message ?? "JSON-RPC Error") + detail;

      toast.error("Sidecar Error", {
        description: response.error.message ?? "An unexpected error occurred",
      });

      throw new Error(errorMsg);
    }

    return response.result as T;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);

    // Only toast if it's a transport error (JSON-RPC errors are handled above)
    if (!message.includes("JSON-RPC Error") && !message.includes("Sidecar Error")) {
      toast.error("Connection Error", {
        description: "Failed to communicate with the sidecar. Is it running?",
      });
    }

    throw err;
  }
}
