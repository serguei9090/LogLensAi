/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Application mode: "web" for browser-only, undefined for Tauri desktop. */
  readonly VITE_APP_MODE?: "web";
  /** Override sidecar RPC endpoint URL. Defaults to "http://localhost:4001/rpc". */
  readonly VITE_SIDECAR_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
