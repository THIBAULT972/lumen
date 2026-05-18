import type { LucideIcon } from "lucide-react";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass-panel rounded-xl p-3 sm:rounded-2xl sm:p-6">
      <div className="flex items-start justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-foreground/10 bg-foreground/[0.03] sm:h-10 sm:w-10 sm:rounded-xl">
          <Icon className="h-3.5 w-3.5 text-muted-foreground sm:h-4 sm:w-4" />
        </div>
      </div>
      <p className="mt-2 text-[9px] uppercase tracking-[0.18em] text-muted-foreground sm:mt-5 sm:text-[11px] sm:tracking-[0.2em]">
        {label}
      </p>
      <p className="mt-1 font-heading text-xl font-light leading-none sm:mt-2 sm:text-3xl">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[10px] text-muted-foreground/70 sm:mt-2 sm:text-xs">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
