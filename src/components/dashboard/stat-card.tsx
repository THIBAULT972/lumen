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
    <div className="glass-panel rounded-2xl p-6">
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-foreground/10 bg-foreground/[0.03]">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
      </div>
      <p className="mt-5 text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-heading text-3xl font-light leading-none">
        {value}
      </p>
      {hint ? (
        <p className="mt-2 text-xs text-muted-foreground/70">{hint}</p>
      ) : null}
    </div>
  );
}
