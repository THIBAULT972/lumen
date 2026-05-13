import type { MissionStatus } from "../mission-types";
import { cn } from "@/lib/utils";

const LABELS: Record<MissionStatus, string> = {
  draft: "Brouillon",
  broadcast: "Envoyée",
  accepted: "Acceptée",
  in_progress: "En cours",
  completed: "Terminée",
  cancelled: "Annulée",
};

const STYLES: Record<MissionStatus, string> = {
  draft: "border-foreground/15 bg-foreground/[0.04] text-muted-foreground",
  broadcast:
    "border-[oklch(0.65_0.22_258/0.5)] bg-[oklch(0.5_0.22_258/0.18)] text-[oklch(0.88_0.18_258)]",
  accepted:
    "border-[oklch(0.6_0.25_305/0.5)] bg-[oklch(0.5_0.25_305/0.18)] text-[oklch(0.88_0.2_305)]",
  in_progress:
    "border-[oklch(0.7_0.18_200/0.5)] bg-[oklch(0.5_0.18_200/0.15)] text-[oklch(0.85_0.15_200)]",
  completed:
    "border-[oklch(0.65_0.2_140/0.5)] bg-[oklch(0.5_0.18_140/0.18)] text-[oklch(0.85_0.18_140)]",
  cancelled:
    "border-destructive/30 bg-destructive/10 text-destructive",
};

export function MissionStatusBadge({
  status,
  compact = false,
}: {
  status: MissionStatus;
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

export function missionStatusLabel(status: MissionStatus): string {
  return LABELS[status];
}
