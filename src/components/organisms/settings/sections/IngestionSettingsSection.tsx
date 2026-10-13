import { Switch } from "@/components/ui/switch";
import type { AppSettings } from "@/store/settingsStore";
import { Activity, Terminal } from "lucide-react";
import { SectionLabel } from "../components/SectionLabel";

interface IngestionSettingsSectionProps {
  readonly settings: AppSettings;
  readonly update: <K extends keyof AppSettings>(
    key: K,
    val: AppSettings[K],
    saveImmediately?: boolean,
  ) => void;
  readonly onSave: (settings: AppSettings) => void;
}

export function IngestionSettingsSection({
  settings,
  update,
  onSave,
}: IngestionSettingsSectionProps) {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="border-b border-border pb-6">
        <h2 className="text-2xl font-bold text-text-primary">Network Ingestion</h2>
        <p className="text-sm text-text-muted mt-2">
          Listen for live log streams from external servers via common protocols.
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-2xl p-6 hover:bg-bg-surface transition-colors">
          <div className="flex items-center gap-4">
            <div className="bg-primary/20 p-2.5 rounded-xl">
              <Terminal className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">Syslog UDP Listener</p>
              <p className="text-xs text-text-muted mt-0.5">
                Accept logs from Linux/Unix servers using standard syslog format.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <SectionLabel htmlFor="syslog_port">UDP Port</SectionLabel>
              <input
                id="syslog_port"
                type="number"
                className="w-20 h-8 rounded-lg bg-bg-surface border border-border text-center text-xs text-text-primary focus:outline-none focus:border-primary transition-all"
                value={settings.ingestion_syslog_port}
                onChange={(e) =>
                  update("ingestion_syslog_port", Number.parseInt(e.target.value, 10), false)
                }
                onBlur={() => onSave(settings)}
              />
            </div>
            <Switch
              checked={settings.ingestion_syslog_enabled}
              onCheckedChange={(checked) => update("ingestion_syslog_enabled", checked)}
            />
          </div>
        </div>

        <div className="flex items-center justify-between bg-bg-surface/50 border border-border rounded-2xl p-6 hover:bg-bg-surface transition-colors">
          <div className="flex items-center gap-4">
            <div className="bg-blue-500/10 p-2.5 rounded-xl">
              <Activity className="h-5 w-5 text-blue-400" />
            </div>
            <div>
              <p className="text-sm font-bold text-text-primary">HTTP Ingestion API</p>
              <p className="text-xs text-text-muted mt-0.5">
                Ingest logs via POST requests to <code>/ingest</code> using JSON payloads.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex flex-col items-end">
              <SectionLabel htmlFor="http_port">TCP Port</SectionLabel>
              <input
                id="http_port"
                type="number"
                className="w-20 h-8 rounded-lg bg-bg-surface border border-border text-center text-xs text-text-primary focus:outline-none focus:border-primary transition-all"
                value={settings.ingestion_http_port}
                onChange={(e) =>
                  update("ingestion_http_port", Number.parseInt(e.target.value, 10), false)
                }
                onBlur={() => onSave(settings)}
              />
            </div>
            <Switch
              checked={settings.ingestion_http_enabled}
              onCheckedChange={(checked) => update("ingestion_http_enabled", checked)}
            />
          </div>
        </div>

        <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10">
          <p className="text-xs font-bold text-primary uppercase tracking-widest mb-2 font-mono">
            Routing Instructions
          </p>
          <p className="text-xs text-text-secondary leading-relaxed space-y-2 flex flex-col">
            <span>
              To route logs to a specific workspace and collection, use the path:{" "}
              <code className="bg-white/5 px-1.5 py-0.5 rounded text-text-primary ml-1">
                POST http://localhost:{settings.ingestion_http_port}
                /ingest/my-workspace/my-collection
              </code>
            </span>
            <span>
              Or use query parameters:{" "}
              <code className="bg-white/5 px-1.5 py-0.5 rounded text-text-primary ml-1">
                /ingest?ws=my-workspace&source_id=my-collection
              </code>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
