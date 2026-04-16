import { SettingsPanel } from "@/components/organisms/SettingsPanel";
import { type AppSettings } from "@/store/settingsStore";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { toast } from "sonner";

export function SettingsPage() {
  const handleSave = async (settings: AppSettings) => {
    try {
      // Serialize all settings values to strings as per the JSON-RPC contract
      const serialized = Object.fromEntries(
        Object.entries(settings).map(([k, v]) => [k, String(v)]),
      );
      await callSidecar({ method: "update_settings", params: { settings: serialized } });
      toast.success("Settings saved.");
    } catch {
      toast.error("Failed to save settings.");
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-[#0a0c0b] h-full">
      <SettingsPanel onSave={handleSave} />
    </div>
  );
}
