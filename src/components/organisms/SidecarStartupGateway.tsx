// Assume Role: Frontend Engineer (@frontend)

import { AlertCircle, CheckCircle2, Loader2, RefreshCw, Terminal } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";

const MAX_PROBES = 3;
const PROBE_DELAY_MS = 1400;

interface SidecarStartupGatewayProps {
  children: ReactNode;
}

export function SidecarStartupGateway({ children }: Readonly<SidecarStartupGatewayProps>) {
  const [isReady, setIsReady] = useState(false);
  const [probeAttempt, setProbeAttempt] = useState(1);
  const [hasFailed, setHasFailed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const probeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runProbe = useCallback(async (attempt: number) => {
    setProbeAttempt(attempt);
    setHasFailed(false);

    try {
      // Direct silent probe to sidecar
      const res = await callSidecar<{ status: string }>({
        method: "get_health",
        params: {},
        silent: true,
      });

      if (res?.status) {
        // Successfully connected to backend
        setIsReady(true);
        setIsRetrying(false);
        return;
      }
    } catch (_err) {
      // Backend not yet listening on port 5000
    }

    if (attempt < MAX_PROBES) {
      probeTimerRef.current = setTimeout(() => {
        runProbe(attempt + 1);
      }, PROBE_DELAY_MS);
    } else {
      // All 3 initial probes exhausted
      setHasFailed(true);
      setIsRetrying(false);
    }
  }, []);

  useEffect(() => {
    runProbe(1);
    return () => {
      if (probeTimerRef.current) {
        clearTimeout(probeTimerRef.current);
      }
    };
  }, [runProbe]);

  const handleManualRetry = () => {
    setIsRetrying(true);
    runProbe(1);
  };

  if (isReady) {
    return <>{children}</>;
  }

  const progressPercent = Math.min(100, Math.round((probeAttempt / MAX_PROBES) * 90));

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-bg-app select-none animate-in fade-in duration-300">
      {/* Background glow effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-primary/10 rounded-full blur-[120px]" />
        <div className="absolute -bottom-[20%] left-1/2 -translate-x-1/2 w-[600px] h-[500px] bg-emerald-500/5 rounded-full blur-[140px]" />
      </div>

      <div className="relative z-10 max-w-md w-full mx-4 p-8 rounded-2xl bg-bg-surface/80 border border-border/70 backdrop-blur-xl shadow-2xl flex flex-col items-center text-center">
        {/* App Logo / Status Indicator */}
        <div className="relative mb-6">
          <div className="w-16 h-16 rounded-2xl bg-bg-surface-bright/80 border border-border flex items-center justify-center shadow-inner">
            {hasFailed ? (
              <AlertCircle className="size-8 text-rose-400 animate-pulse" />
            ) : isReady ? (
              <CheckCircle2 className="size-8 text-primary" />
            ) : (
              <Loader2 className="size-8 text-primary animate-spin" />
            )}
          </div>
          {!hasFailed && (
            <div className="absolute -inset-1 bg-primary/20 rounded-2xl blur-md -z-10 animate-pulse" />
          )}
        </div>

        {/* Headings */}
        <h2 className="text-xl font-bold font-mono tracking-wider text-text-primary uppercase mb-2">
          {hasFailed ? "Engine Unreachable" : "Starting LogLens Engine"}
        </h2>
        <p className="text-xs text-text-muted leading-relaxed mb-6 max-w-xs">
          {hasFailed
            ? "Could not establish JSON-RPC communication with the Go sidecar service on port 5000."
            : "Initializing DuckDB columnar storage, Drain3 clustering miners, and RPC transports..."}
        </p>

        {/* Dynamic Progress or Error State */}
        {!hasFailed ? (
          <div className="w-full space-y-3">
            {/* Progress Bar */}
            <div className="w-full h-1.5 bg-bg-surface-bright rounded-full overflow-hidden border border-border/40">
              <div
                className="h-full bg-gradient-to-r from-primary/80 to-primary transition-all duration-700 ease-out rounded-full"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-text-muted px-0.5">
              <span className="flex items-center gap-1.5">
                <span className="size-1.5 rounded-full bg-primary animate-ping" />
                Connecting to sidecar...
              </span>
              <span>
                Probe {probeAttempt} / {MAX_PROBES}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-full space-y-4">
            <div className="p-3.5 rounded-xl bg-bg-surface-bright/50 border border-border/60 text-left space-y-1.5">
              <div className="flex items-center gap-1.5 text-xs font-mono text-text-secondary">
                <Terminal className="size-3.5 text-amber-400" />
                <span>Verify Backend Service:</span>
              </div>
              <p className="text-[11px] font-mono text-text-muted pl-5 select-all">
                bun run dev:api
              </p>
            </div>

            <Button
              onClick={handleManualRetry}
              disabled={isRetrying}
              className="w-full h-10 bg-primary hover:bg-primary-hover text-black font-bold uppercase tracking-wider text-xs gap-2 rounded-xl transition-transform active:scale-95 shadow-md shadow-primary/20"
            >
              {isRetrying ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              <span>Retry Connection</span>
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
