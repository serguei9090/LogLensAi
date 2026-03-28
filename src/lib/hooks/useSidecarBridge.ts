import { invoke } from "@tauri-apps/api/core";

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
 * Dispatches a JSON-RPC request to the Python sidecar via the Tauri Rust bridge.
 * In dev mode: routes to http://localhost:5000/rpc via the Rust HTTP bridge.
 * In prod mode: routed via stdin/stdout sidecar.
 */
export async function callSidecar<T>(request: SidecarRequest): Promise<T> {
  const rpcReq = {
    jsonrpc: "2.0",
    id: Math.floor(Math.random() * 10000),
    method: request.method,
    params: request.params ?? {},
  };

  const responseStr = await invoke<string>("dispatch_sidecar", {
    request: JSON.stringify(rpcReq),
  });

  const response: SidecarResponse<T> = JSON.parse(responseStr);

  if (response.error) {
    const detail = response.error.data
      ? `\n\nDetail:\n${typeof response.error.data === "string" ? response.error.data : JSON.stringify(response.error.data, null, 2)}`
      : "";
    throw new Error((response.error.message ?? "JSON-RPC Error") + detail);
  }

  return response.result as T;
}
