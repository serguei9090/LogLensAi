import { LayaSettingsPanel } from "@/components/organisms/laya-settings";

export function LayaSettingsSection() {
  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="border-b border-border pb-6">
        <h2 className="text-2xl font-bold text-text-primary">Laya AI</h2>
        <p className="text-sm text-text-muted mt-2">
          Fast decision routing, cluster triage rules, and versioned checkpoints.
        </p>
      </div>
      <LayaSettingsPanel />
    </div>
  );
}
