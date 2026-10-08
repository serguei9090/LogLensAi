import { callSidecar } from "@/lib/hooks/useSidecarBridge";

export const traceIngestion = async (message: string) => {
  try {
    await callSidecar("log_trace", { message });
  } catch (e) {
    console.warn("Failed to write to ingestion trace log:", e);
  }
};
