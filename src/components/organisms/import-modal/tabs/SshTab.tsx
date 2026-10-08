import { TailSwitch } from "@/components/atoms/TailSwitch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useIngestionStore } from "@/store/ingestion";
import { Terminal } from "lucide-react";
import { inputCls, labelCls } from "../constants";
import type { SshTabProps } from "../types";

export function SshTab({
  sshHost,
  setSshHost,
  sshPort,
  setSshPort,
  sshUser,
  setSshUser,
  sshPass,
  setSshPass,
  sshPath,
  setSshPath,
  sshTail,
  setSshTail,
  onImportSSH,
}: SshTabProps) {
  const isProcessing = useIngestionStore((state) => state.isImportProcessing);
  return (
    <div className="space-y-6 animate-in slide-in-from-left-4 duration-500">
      <div className="grid grid-cols-4 gap-4">
        <div className="col-span-3 space-y-2">
          <label htmlFor="ssh-host" className={labelCls}>
            Secure Host
          </label>
          <input
            id="ssh-host"
            disabled={isProcessing}
            placeholder="server.prod.local"
            className={cn(inputCls, "h-11")}
            value={sshHost}
            onChange={(e) => setSshHost(e.target.value)}
          />
        </div>
        <div className="col-span-1 space-y-2">
          <label htmlFor="ssh-port" className={labelCls}>
            Port
          </label>
          <input
            id="ssh-port"
            type="number"
            disabled={isProcessing}
            className={cn(inputCls, "h-11")}
            value={sshPort}
            onChange={(e) => setSshPort(e.target.value)}
          />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="ssh-user" className={labelCls}>
            Login User
          </label>
          <input
            id="ssh-user"
            disabled={isProcessing}
            className={cn(inputCls, "h-11")}
            value={sshUser}
            onChange={(e) => setSshUser(e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="ssh-pass" className={labelCls}>
            Secret / Key
          </label>
          <input
            id="ssh-pass"
            type="password"
            disabled={isProcessing}
            placeholder="••••••••"
            className={cn(inputCls, "h-11")}
            value={sshPass}
            onChange={(e) => setSshPass(e.target.value)}
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="ssh-path" className={labelCls}>
          Absolute Log Path
        </label>
        <input
          id="ssh-path"
          disabled={isProcessing}
          placeholder="/var/log/syslog"
          className={cn(inputCls, "font-mono text-xs h-11")}
          value={sshPath}
          onChange={(e) => setSshPath(e.target.value)}
        />
      </div>
      <div className="flex items-center justify-between pt-6 border-t border-border/40">
        <TailSwitch
          checked={sshTail}
          onCheckedChange={setSshTail}
          label="Stream remotely"
          disabled={isProcessing}
        />
        <Button
          disabled={!sshHost || !sshUser || !sshPath || isProcessing}
          size="lg"
          onClick={() => {
            onImportSSH(sshHost, Number(sshPort), sshUser, sshPass, sshPath, sshTail);
          }}
          className="font-black"
        >
          {isProcessing ? (
            <div className="w-5 h-5 border-2 border-current border-t-transparent rounded-full animate-spin mr-2" />
          ) : (
            <Terminal className="size-5" />
          )}
          {isProcessing ? "Connecting..." : "Connect"}
        </Button>
      </div>
    </div>
  );
}
