import { Button } from "@/components/ui/button";

interface StrategyCardProps {
  readonly icon: React.ReactNode;
  readonly name: string;
  readonly description: string;
  readonly onClick: () => void;
}

export function StrategyCard({ icon, name, description, onClick }: StrategyCardProps) {
  return (
    <Button
      variant="ghost"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-3 rounded-lg border border-white/5 bg-white/[0.02] hover:bg-white/[0.04] transition-all text-left group h-auto"
    >
      <div className="size-8 rounded-md bg-white/5 border border-white/10 text-white/50 flex items-center justify-center group-hover:text-white transition-all shrink-0">
        {icon}
      </div>
      <div className="space-y-0.5 flex-1 min-w-0">
        <p className="text-sm font-medium text-white/90 group-hover:text-white transition-colors truncate">
          {name}
        </p>
        <p className="text-xs text-white/40 leading-relaxed truncate">{description}</p>
      </div>
    </Button>
  );
}
