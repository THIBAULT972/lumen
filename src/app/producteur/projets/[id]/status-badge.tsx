import type { EpisodeStatus } from "../episode-types";
import { cn } from "@/lib/utils";

const LABELS: Record<EpisodeStatus, string> = {
  idea: "Idée",
  planning: "En préparation",
  shooting: "En tournage",
  editing: "En montage",
  delivered: "Livré",
  published: "Publié",
};

const STYLES: Record<EpisodeStatus, string> = {
  idea: "border-foreground/15 bg-foreground/[0.04] text-muted-foreground",
  planning:
    "border-[oklch(0.7_0.18_200/0.5)] bg-[oklch(0.5_0.18_200/0.15)] text-[oklch(0.85_0.15_200)]",
  shooting:
    "border-[oklch(0.65_0.22_258/0.5)] bg-[oklch(0.5_0.22_258/0.18)] text-[oklch(0.88_0.18_258)]",
  editing:
    "border-[oklch(0.6_0.25_305/0.5)] bg-[oklch(0.5_0.25_305/0.18)] text-[oklch(0.88_0.2_305)]",
  delivered:
    "border-[oklch(0.65_0.2_140/0.5)] bg-[oklch(0.5_0.18_140/0.18)] text-[oklch(0.85_0.18_140)]",
  published:
    "border-[oklch(0.7_0.2_85/0.5)] bg-[oklch(0.55_0.18_85/0.18)] text-[oklch(0.88_0.18_85)]",
};

export function StatusBadge({
  status,
  compact = false,
}: {
  status: EpisodeStatus;
  compact?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 font-medium uppercase tracking-wider",
        STYLES[status],
        compact ? "text-[9px]" : "text-[10px]",
      )}
    >
      {LABELS[status]}
    </span>
  );
}

export function statusLabel(status: EpisodeStatus): string {
  return LABELS[status];
}
