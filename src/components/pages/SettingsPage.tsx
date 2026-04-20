import { SettingsPanel } from "@/components/organisms/SettingsPanel";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { type AppSettings, useSettingsStore } from "@/store/settingsStore";
import { toast } from "sonner";

export function SettingsPage() {
  const { updateSettings } = useSettingsStore();
  const handleSave = async (settings: AppSettings) => {
    // We pass the whole object to updateSettings, which will handle debouncing
    // and persistence to the sidecar.
    updateSettings(settings);
  };

  return (
    <div className="flex-1 overflow-auto bg-[#0a0c0b] h-full">
      <SettingsPanel onSave={handleSave} />
    </div>
  );
}
