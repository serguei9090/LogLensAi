// Assume Role: Frontend Engineer (@frontend)

import { type AppSettings, useSettingsStore } from "@/store/settingsStore";
import { Suspense, lazy } from "react";

const SettingsPanel = lazy(() =>
  import("@/components/organisms/SettingsPanel").then((m) => ({ default: m.SettingsPanel })),
);

export function SettingsPage() {
  const { updateSettings } = useSettingsStore();
  const handleSave = async (settings: AppSettings) => {
    // We pass the whole object to updateSettings, which will handle debouncing
    // and persistence to the sidecar.
    updateSettings(settings);
  };

  return (
    <div className="flex-1 overflow-auto bg-bg-app h-full">
      <Suspense
        fallback={
          <div
            data-testid="settings-loader"
            className="p-8 text-xs font-mono text-text-muted animate-pulse"
          >
            Loading settings...
          </div>
        }
      >
        <SettingsPanel onSave={handleSave} />
      </Suspense>
    </div>
  );
}
