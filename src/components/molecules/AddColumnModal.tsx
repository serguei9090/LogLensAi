// Assume Role: Frontend Engineer (@frontend)
import { AlertCircle, CheckCircle2, Loader2, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { callSidecar } from "@/lib/hooks/useSidecarBridge";
import { cn } from "@/lib/utils";
import type { CustomColumnDef } from "@/store/uiStore";
import { selectActiveWorkspace, useWorkspaceStore } from "@/store/workspaceStore";

// ─── Types ────────────────────────────────────────────────────────────────────

interface AddColumnModalProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onSave: (col: CustomColumnDef) => void;
}

interface PreviewRow {
  raw: string;
  match: string | null;
}

const WIDTH_OPTIONS = [
  { value: "72px", label: "Tiny (72px)" },
  { value: "90px", label: "Small (90px)" },
  { value: "120px", label: "Medium (120px)" },
  { value: "160px", label: "Large (160px)" },
  { value: "200px", label: "X-Large (200px)" },
  { value: "260px", label: "Wide (260px)" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export function AddColumnModal({ open, onOpenChange, onSave }: AddColumnModalProps) {
  const activeWorkspace = useWorkspaceStore(selectActiveWorkspace);
  const activeSourceId = activeWorkspace?.activeSourceId ?? null;

  const [label, setLabel] = useState("");
  const [regex, setRegex] = useState("");
  const [width, setWidth] = useState("120px");
  const [samples, setSamples] = useState<string[]>([]);
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [regexError, setRegexError] = useState<string | null>(null);
  const [isFetchingSamples, setIsFetchingSamples] = useState(false);

  // Fetch sample logs when modal opens
  useEffect(() => {
    if (!open || !activeWorkspace?.id) {
      return;
    }
    setIsFetchingSamples(true);
    callSidecar<{ samples: string[] }>({
      method: "get_sample_logs",
      params: {
        workspace_id: activeWorkspace.id,
        limit: 10,
        source_id: activeSourceId ?? undefined,
      },
    })
      .then((res) => setSamples(res.samples ?? []))
      .catch(() => setSamples([]))
      .finally(() => setIsFetchingSamples(false));
  }, [open, activeWorkspace?.id, activeSourceId]);

  // Recompute preview when regex or samples change
  useEffect(() => {
    if (!regex.trim()) {
      setPreview(samples.map((raw) => ({ raw, match: null })));
      setRegexError(null);
      return;
    }
    try {
      const re = new RegExp(regex);
      setRegexError(null);
      setPreview(
        samples.map((raw) => {
          const m = re.exec(raw);
          return { raw, match: m?.[1] ?? m?.[0] ?? null };
        }),
      );
    } catch (e: any) {
      setRegexError(e.message ?? "Invalid regex");
      setPreview(samples.map((raw) => ({ raw, match: null })));
    }
  }, [regex, samples]);

  const handleSave = () => {
    if (!label.trim() || !regex.trim() || regexError) {
      return;
    }
    const id = `custom_${label.toLowerCase().replaceAll(/\s+/g, "_")}_${Date.now()}`;
    onSave({ id, label: label.trim(), width, source: "user", regex });
    // Reset form
    setLabel("");
    setRegex("");
    setWidth("120px");
    onOpenChange(false);
  };

  const matchCount = preview.filter((r) => r.match !== null).length;
  const hasMatches = matchCount > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl w-full bg-bg-surface border-border text-text-primary">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Plus className="size-4 text-primary" />
            Add Custom Column
          </DialogTitle>
          <DialogDescription className="text-text-muted text-sm">
            Define a regex to extract a value from each log line and display it as a new column.
            Group 1 <code className="text-primary font-mono">(...)</code> is used as the cell value.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
          {/* Column Name */}
          <div className="space-y-1.5">
            <Label
              htmlFor="col-label"
              className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
            >
              Column Name
            </Label>
            <Input
              id="col-label"
              placeholder="e.g. User Agent"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="bg-bg-base border-border text-text-primary placeholder:text-text-muted focus-visible:ring-primary/50"
            />
          </div>

          {/* Width */}
          <div className="space-y-1.5">
            <Label
              htmlFor="col-width"
              className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
            >
              Column Width
            </Label>
            <Select
              value={width}
              onValueChange={(v) => {
                if (v) {
                  setWidth(v);
                }
              }}
            >
              <SelectTrigger
                id="col-width"
                className="bg-bg-base border-border text-text-primary focus:ring-primary/50"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-bg-surface border-border">
                {WIDTH_OPTIONS.map((opt) => (
                  <SelectItem
                    key={opt.value}
                    value={opt.value}
                    className="text-text-primary hover:bg-white/5"
                  >
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Regex */}
          <div className="col-span-1 sm:col-span-2 space-y-1.5">
            <Label
              htmlFor="col-regex"
              className="text-xs font-semibold uppercase tracking-wider text-text-secondary"
            >
              Regex Pattern
            </Label>
            <Textarea
              id="col-regex"
              placeholder={`e.g. "([^"]+)"$   or   \\s(\\d{3})\\s`}
              value={regex}
              onChange={(e) => setRegex(e.target.value)}
              rows={2}
              className="font-mono text-sm bg-bg-base border-border text-text-primary placeholder:text-text-muted focus-visible:ring-primary/50 resize-none"
            />
            {regexError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <AlertCircle className="size-3 shrink-0" />
                {regexError}
              </p>
            )}
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Preview (10 random lines)
            </span>
            {regex && !regexError && (
              <span
                className={cn(
                  "text-xs flex items-center gap-1 font-medium",
                  hasMatches ? "text-primary" : "text-text-muted",
                )}
              >
                {hasMatches ? (
                  <CheckCircle2 className="size-3" />
                ) : (
                  <AlertCircle className="size-3" />
                )}
                {matchCount}/{samples.length} matches
              </span>
            )}
          </div>

          <div className="rounded-lg border border-border bg-bg-base overflow-hidden max-h-60 overflow-y-auto custom-scrollbar">
            {isFetchingSamples ? (
              <div className="flex items-center justify-center gap-2 py-8 text-text-muted text-sm">
                <Loader2 className="size-4 animate-spin" />
                Loading samples…
              </div>
            ) : samples.length === 0 ? (
              <p className="text-center py-8 text-text-muted text-sm">
                No logs available in this workspace.
              </p>
            ) : (
              <div className="divide-y divide-border/50">
                {preview.map((row, i) => (
                  <div key={i} className="px-3 py-2 group hover:bg-white/[0.02]">
                    {/* Raw line — wrapped */}
                    <p className="font-mono text-[11px] text-text-muted break-all whitespace-pre-wrap leading-tight">
                      {row.raw}
                    </p>
                    {/* Extracted value */}
                    {row.match !== null ? (
                      <p className="font-mono text-[11px] text-primary mt-0.5 break-all whitespace-pre-wrap">
                        → <span className="bg-primary/10 px-1 rounded">{row.match}</span>
                      </p>
                    ) : regex && !regexError ? (
                      <p className="font-mono text-[11px] text-text-muted/40 mt-0.5 break-all whitespace-pre-wrap">
                        → no match
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            className="text-text-muted hover:text-text-primary"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!label.trim() || !regex.trim() || !!regexError}
            className="bg-primary hover:bg-primary/90 text-white font-semibold disabled:opacity-40"
          >
            <Plus className="size-4 mr-1.5" />
            Add Column
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
