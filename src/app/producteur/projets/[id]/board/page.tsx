import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { ensureProjectBoard } from "./board-actions";
import { BoardCanvas } from "./board-canvas";
import type { BoardConnection, BoardItem } from "./board-types";

export default async function ProjectBoardPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const ensured = await ensureProjectBoard(project.id);
  if (!ensured.ok) {
    return (
      <div className="glass-panel rounded-2xl border border-destructive/30 bg-destructive/5 p-6 text-sm">
        <p className="font-medium text-destructive">
          Impossible d'ouvrir le moodboard.
        </p>
        <p className="mt-1 text-muted-foreground">
          <code className="font-mono">{ensured.error}</code>
        </p>
        <p className="mt-3 text-xs text-muted-foreground">
          La migration 007 est peut-être à appliquer dans Supabase.
        </p>
      </div>
    );
  }

  const { board } = ensured;

  const [itemsRes, connectionsRes] = await Promise.all([
    supabase
      .from("board_items")
      .select(
        "id, board_id, type, content, position_x, position_y, width, height, z_index, created_at, updated_at",
      )
      .eq("board_id", board.id)
      .order("z_index", { ascending: true }),
    supabase
      .from("board_connections")
      .select("id, board_id, from_item_id, to_item_id, label, created_at")
      .eq("board_id", board.id),
  ]);

  const items: BoardItem[] = (itemsRes.data ?? []) as BoardItem[];
  const connections: BoardConnection[] = (connectionsRes.data ?? []) as BoardConnection[];

  // Fullscreen overlay : couvre tout le viewport, par-dessus le shell
  // producteur (nav + header). L'utilisateur sort via le bouton Retour.
  return (
    <div className="fixed inset-0 z-40 flex flex-col bg-background">
      <header className="grid grid-cols-3 items-center gap-4 border-b border-border bg-background/95 px-4 py-3 backdrop-blur-sm">
        <div className="justify-self-start">
          <Link
            href={`/producteur/projets/${project.id}`}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-1.5 text-xs uppercase tracking-wider text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Retour au projet
          </Link>
        </div>

        <div className="min-w-0 justify-self-center text-center">
          <p className="flex items-center justify-center gap-1.5 text-[10px] uppercase tracking-[0.28em] text-muted-foreground">
            <Sparkles className="h-3 w-3" />
            Espace de création
          </p>
          <p className="truncate font-heading text-base font-light leading-tight">
            <span className="text-foreground">{project.name}</span>
            <span className="text-muted-foreground"> · {board.name}</span>
          </p>
        </div>

        <div className="justify-self-end" />
      </header>

      <div className="relative flex-1 overflow-hidden">
        <BoardCanvas
          boardId={board.id}
          projectId={project.id}
          initialItems={items}
          initialConnections={connections}
        />
      </div>
    </div>
  );
}
