"use server";

import { getProducteur } from "@/lib/auth/guard";
import {
  summarizeMeeting,
  type MeetingSummary,
} from "@/lib/ai/meeting-summarizer";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

export async function summarizeMeetingNotes(
  notes: string,
): Promise<Result<{ summary: MeetingSummary }>> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  return summarizeMeeting(notes);
}
