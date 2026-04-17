import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import { Clock, HelpCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

interface TimeShiftModalProps {
  readonly isOpen: boolean;
  readonly onClose: () => void;
  /** Current offset in seconds */
  readonly initialShiftSeconds: number;
  readonly sourceLabel: string;
  readonly onSaved: (seconds: number) => void;
}

export function TimeShiftModal({
  isOpen,
  onClose,
  initialShiftSeconds,
  sourceLabel,
  onSaved,
}: TimeShiftModalProps) {
  const [mode, setMode] = useState<"relative" | "sample">("relative");

  // Relative Mode State
  const [days, setDays] = useState(0);
  const [hours, setHours] = useState(0);
  const [mins, setMins] = useState(0);
  const [secs, setSecs] = useState(0);
  const [isNegative, setIsNegative] = useState(false);

  // Sample Mode State
  const [originalTs, setOriginalTs] = useState("");
  const [targetTs, setTargetTs] = useState("");

  // Initialize from props
  useEffect(() => {
    if (isOpen) {
      const total = Math.abs(initialShiftSeconds);
      setIsNegative(initialShiftSeconds < 0);
      setDays(Math.floor(total / (24 * 3600)));
      setHours(Math.floor((total % (24 * 3600)) / 3600));
      setMins(Math.floor((total % 3600) / 60));
      setSecs(total % 60);

      setOriginalTs("");
      setTargetTs("");
    }
  }, [isOpen, initialShiftSeconds]);

  const handleApply = () => {
    let total = 0;
    if (mode === "relative") {
      total = days * 24 * 3600 + hours * 3600 + mins * 60 + secs;
      if (isNegative) {
        total *= -1;
      }
    } else {
      // Calculate from samples
      try {
        const d1 = new Date(originalTs.replace(" ", "T"));
        const d2 = new Date(targetTs.replace(" ", "T"));

        if (Number.isNaN(d1.getTime()) || Number.isNaN(d2.getTime())) {
          toast.error("Invalid timestamp format. Use YYYY-MM-DD HH:MM:SS");
          return;
        }

        total = Math.floor((d2.getTime() - d1.getTime()) / 1000);
      } catch (e) {
        console.error("Time parse error:", e);
        toast.error("Failed to parse timestamps.");
        return;
      }
    }

    onSaved(total);
    onClose();
  };

  const calculatedTotal = days * 24 * 3600 + hours * 3600 + mins * 60 + secs;
  const formattedShift =
    calculatedTotal === 0 ? "0s" : `${String(isNegative ? "-" : "+") + calculatedTotal}s`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[420px] bg-[#111] border-white/10 text-white shadow-xl z-[250] p-0 overflow-hidden rounded-xl">
        <div className="p-6">
          <DialogHeader className="mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded bg-white/5 text-white/70 border border-white/10">
                <Clock className="size-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold tracking-tight text-white/90">
                  Time Alignment
                </DialogTitle>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-[11px] text-white/40">Target:</span>
                  <span className="text-[11px] text-white/70 font-mono bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
                    {sourceLabel}
                  </span>
                </div>
              </div>
            </div>
          </DialogHeader>

          <Tabs
            defaultValue="relative"
            onValueChange={(v) => setMode(v as "relative" | "sample")}
            className="w-full flex flex-col"
          >
            <div className="space-y-1.5 mb-6">
              <Label className="text-[10px] text-white/50 font-medium px-0.5 uppercase">
                Alignment Mode
              </Label>
              <TabsList className="grid grid-cols-2 bg-white/5 border border-white/10 p-1 rounded-lg">
                <TabsTrigger
                  value="relative"
                  className="py-1.5 rounded-md transition-all text-[11px] font-medium text-white/40 hover:text-white/60 data-active:bg-white/10 data-active:text-white data-active:shadow-sm data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Manual Offset
                </TabsTrigger>
                <TabsTrigger
                  value="sample"
                  className="py-1.5 rounded-md transition-all text-[11px] font-medium text-white/40 hover:text-white/60 data-active:bg-white/10 data-active:text-white data-active:shadow-sm data-[state=active]:bg-white/10 data-[state=active]:text-white data-[state=active]:shadow-sm"
                >
                  Visual Sync
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="relative" className="space-y-6 outline-none">
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: "Days", value: days, set: setDays },
                  { label: "Hours", value: hours, set: setHours },
                  { label: "Mins", value: mins, set: setMins },
                  { label: "Secs", value: secs, set: setSecs },
                ].map((unit) => (
                  <div key={unit.label} className="space-y-1.5">
                    <Label className="text-[10px] text-white/50 font-medium px-0.5 uppercase">
                      {unit.label}
                    </Label>
                    <Input
                      type="number"
                      min="0"
                      value={unit.value}
                      onChange={(e) => unit.set(Math.max(0, Number.parseInt(e.target.value) || 0))}
                      className="bg-white/5 border-white/10 text-center h-9 text-sm rounded-md focus:border-white/30 transition-all font-mono"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-6 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-[10px] text-white/50 font-medium px-0.5 uppercase">
                    Shift Direction
                  </Label>
                  <div className="grid grid-cols-2 bg-white/5 p-1 rounded-lg border border-white/10">
                    <button
                      type="button"
                      onClick={() => setIsNegative(false)}
                      className={cn(
                        "py-1.5 rounded-md transition-all text-[11px] font-medium",
                        isNegative
                          ? "text-white/40 hover:text-white/60"
                          : "bg-white/10 text-white shadow-sm",
                      )}
                    >
                      Add
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsNegative(true)}
                      className={cn(
                        "py-1.5 rounded-md transition-all text-[11px] font-medium",
                        isNegative
                          ? "bg-white/10 text-white shadow-sm"
                          : "text-white/40 hover:text-white/60",
                      )}
                    >
                      Subtract
                    </button>
                  </div>
                </div>

                <div className="flex justify-between items-center px-1 pt-4 border-t border-white/10">
                  <span className="text-[10px] uppercase text-white/40 font-medium">
                    Calculated Shift
                  </span>
                  <span className="font-mono text-sm font-medium text-white/90">
                    {formattedShift}
                  </span>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="sample" className="space-y-5 pt-1 outline-none">
              <div className="p-3 rounded-lg bg-white/5 border border-white/10 flex gap-3">
                <HelpCircle className="size-4 text-white/40 shrink-0 mt-0.5" />
                <p className="text-[11px] text-white/60 leading-relaxed font-medium">
                  Paste a timestamp and specify the desired target time. We'll calculate the offset
                  automatically.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-[10px] text-white/50 font-medium px-0.5 uppercase">
                      Inbound Time
                    </Label>
                    <span className="text-[9px] text-white/30 font-mono">YYYY-MM-DD HH:MM:SS</span>
                  </div>
                  <Input
                    placeholder="2024-05-25 00:00:21"
                    value={originalTs}
                    onChange={(e) => setOriginalTs(e.target.value)}
                    className="bg-white/5 border-white/10 font-mono text-sm h-9 rounded-md focus:border-white/30 transition-all"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-[10px] text-white/50 font-medium px-0.5 uppercase">
                    Target Synchronized Time
                  </Label>
                  <Input
                    placeholder="2024-05-25 02:00:00"
                    value={targetTs}
                    onChange={(e) => setTargetTs(e.target.value)}
                    className="bg-white/5 border-white/10 font-mono text-sm h-9 rounded-md focus:border-white/30 transition-all"
                  />
                </div>
              </div>
            </TabsContent>
          </Tabs>
        </div>

        <DialogFooter className="bg-white/[0.02] border-t border-white/10 px-6 py-4 pb-6 gap-2 flex-row sm:justify-end shrink-0">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-9 px-4 text-xs font-medium text-white/60 hover:text-white"
          >
            Cancel
          </Button>
          <Button
            onClick={handleApply}
            className="h-9 px-6 text-xs font-medium bg-white text-black hover:bg-white/90 shadow-sm"
          >
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
