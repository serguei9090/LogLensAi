import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { FolderOpen } from "lucide-react";
import { toast } from "sonner";

/**
 * Detects whether the app is running inside a Tauri desktop shell.
 */
const isTauri = globalThis.window !== undefined && "__TAURI_INTERNALS__" in globalThis.window;

interface FileFilter {
  name: string;
  extensions: string[];
}

interface NativeFilePickerProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly filters?: FileFilter[];
  readonly className?: string;
  readonly disabled?: boolean;
}

/**
 * NativeFilePicker Molecule
 * Provides a standardized way to select local files, leveraging Tauri's
 * native dialogs on desktop and falling back to browser APIs in web mode.
 */
export function NativeFilePicker({
  value,
  onChange,
  placeholder = "Select a file...",
  filters = [
    { name: "Common Logs", extensions: ["log", "syslog", "txt", "json", "csv"] },
    { name: "All Files", extensions: ["*"] },
  ],
  className,
  disabled = false,
}: NativeFilePickerProps) {
  const handleBrowse = async () => {
    if (isTauri) {
      try {
        const { open: openDialog } = await import("@tauri-apps/plugin-dialog");
        const selected = await openDialog({
          multiple: false,
          directory: false,
          title: "Select File",
          filters,
        });

        if (selected) {
          onChange(Array.isArray(selected) ? selected[0] : selected);
        }
      } catch (e) {
        console.warn("Native dialog error:", e);
        toast.error("Could not open file picker.");
      }
    } else {
      // Web mode fallback
      const input = document.createElement("input");
      input.type = "file";
      input.accept = filters
        .flatMap((f) => f.extensions)
        .filter((ext) => ext !== "*")
        .map((ext) => `.${ext}`)
        .join(",");

      input.onchange = () => {
        const file = input.files?.[0];
        if (file) {
          onChange(file.name);
        }
      };
      input.click();
    }
  };

  return (
    <div className={cn("flex w-full items-center gap-2", className)}>
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="font-mono text-xs"
      />
      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={handleBrowse}
        disabled={disabled}
        className="shrink-0 font-bold"
      >
        <FolderOpen className="mr-2 h-4 w-4" />
        Browse
      </Button>
    </div>
  );
}
