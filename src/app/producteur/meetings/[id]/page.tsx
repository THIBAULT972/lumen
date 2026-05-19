import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getMeetingReport } from "../../meeting-actions";
import { MeetingDetailClient } from "./meeting-detail-client";

export default async function MeetingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const r = await getMeetingReport(id);
  if (!r.ok) notFound();

  return (
    <>
      <Link
        href="/producteur/meetings"
        className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Tous les comptes-rendus
      </Link>

      <MeetingDetailClient initialReport={r.report} />
    </>
  );
}
