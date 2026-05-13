"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  StickyNote,
  ImagePlus,
  Link2,
  Trash2,
  Loader2,
  ExternalLink,
  Palette,
  X,
  Plus,
  Spline,
  ListChecks,
  Square,
  CheckSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { createClient as createBrowserSupabase } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import {
  createBoardConnection,
  createBoardItem,
  deleteBoardConnection,
  deleteBoardItem,
  getBoardImageUrl,
  requestBoardImageUpload,
  updateBoardItem,
} from "./board-actions";
import {
  NOTE_COLORS,
  type BoardConnection,
  type BoardItem,
  type BoardItemType,
  type ImageContent,
  type LinkContent,
  type NoteContent,
  type TodoContent,
  type TodoItem,
} from "./board-types";

const CANVAS_MIN_HEIGHT = 1600;
const STORAGE_BUCKET = "files";

export function BoardCanvas({
  boardId,
  projectId,
  initialItems,
  initialConnections,
}: {
  boardId: string;
  projectId: string;
  initialItems: BoardItem[];
  initialConnections: BoardConnection[];
}) {
  const [items, setItems] = useState<BoardItem[]>(initialItems);
  const [connections, setConnections] =
    useState<BoardConnection[]>(initialConnections);
  const [linkOpen, setLinkOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // When non-null: user is currently drawing a connection from this item.
  // mouseX/mouseY are in canvas-content coordinates (i.e. after scroll).
  const [connecting, setConnecting] = useState<{
    fromItemId: string;
    mouseX: number;
    mouseY: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  // ID de l'item en cours d'édition de contenu (texte de note, titre de
  // lien). Utilisé pour ignorer les updates entrants en Realtime pour ne
  // pas écraser ce que l'utilisateur est en train de taper.
  const editingItemIdRef = useRef<string | null>(null);
  const setEditingItem = useCallback((id: string | null) => {
    editingItemIdRef.current = id;
  }, []);

  // ---------------------------------------------------------------------
  // Drag state (item move)
  // ---------------------------------------------------------------------
  const dragRef = useRef<{
    itemId: string;
    startMouseX: number;
    startMouseY: number;
    startPosX: number;
    startPosY: number;
  } | null>(null);

  const onItemMouseDown = useCallback(
    (e: React.MouseEvent, item: BoardItem) => {
      // Don't start a drag on form fields or buttons inside the card
      const target = e.target as HTMLElement;
      if (target.closest("[data-no-drag]")) return;
      e.preventDefault();
      dragRef.current = {
        itemId: item.id,
        startMouseX: e.clientX,
        startMouseY: e.clientY,
        startPosX: item.position_x,
        startPosY: item.position_y,
      };
      document.body.style.cursor = "grabbing";
      document.body.style.userSelect = "none";
    },
    [],
  );

  useEffect(() => {
    function onMove(e: MouseEvent) {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;
      setItems((prev) =>
        prev.map((it) =>
          it.id === d.itemId
            ? {
                ...it,
                position_x: Math.max(0, d.startPosX + dx),
                position_y: Math.max(0, d.startPosY + dy),
              }
            : it,
        ),
      );
    }
    function onUp() {
      const d = dragRef.current;
      if (!d) return;
      dragRef.current = null;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      const finalItem = items.find((it) => it.id === d.itemId);
      if (finalItem) {
        // Fire and forget — the server has the new position
        void updateBoardItem(d.itemId, projectId, {
          position_x: finalItem.position_x,
          position_y: finalItem.position_y,
        });
      }
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [items, projectId]);

  // ---------------------------------------------------------------------
  // Realtime: subscribe to changes on board_items for this board.
  // Each producteur connected to the same board sees other people's
  // moves / new cards / deletions in (near) real time.
  //
  // Skip rules to avoid clobbering the local user's work:
  //   - currently dragging item        → ignore position updates from server
  //   - currently editing item content → keep local position update but
  //     ignore content (we don't want to overwrite what they're typing)
  // ---------------------------------------------------------------------
  useEffect(() => {
    const supabase = createBrowserSupabase();
    const channel = supabase
      .channel(`board:${boardId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "board_items",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const item = payload.new as BoardItem;
          setItems((prev) =>
            prev.some((i) => i.id === item.id) ? prev : [...prev, item],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "board_items",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const item = payload.new as BoardItem;
          if (dragRef.current?.itemId === item.id) return;
          setItems((prev) =>
            prev.map((it) => {
              if (it.id !== item.id) return it;
              // If user is editing this card's content, keep their local
              // content but accept layout updates (position, size).
              if (editingItemIdRef.current === item.id) {
                return {
                  ...it,
                  position_x: item.position_x,
                  position_y: item.position_y,
                  width: item.width,
                  height: item.height,
                  z_index: item.z_index,
                  updated_at: item.updated_at,
                };
              }
              return item;
            }),
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "board_items",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const oldItem = payload.old as { id: string };
          setItems((prev) => prev.filter((i) => i.id !== oldItem.id));
        },
      )
      // ----- Connections -----
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "board_connections",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const conn = payload.new as BoardConnection;
          setConnections((prev) =>
            prev.some((c) => c.id === conn.id) ? prev : [...prev, conn],
          );
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "board_connections",
          filter: `board_id=eq.${boardId}`,
        },
        (payload) => {
          const old = payload.old as { id: string };
          setConnections((prev) => prev.filter((c) => c.id !== old.id));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [boardId]);

  // ---------------------------------------------------------------------
  // Connecting mode : track mouse position relative to canvas content
  // and listen for Escape to cancel.
  // ---------------------------------------------------------------------
  useEffect(() => {
    if (!connecting) return;
    function onMove(e: MouseEvent) {
      const el = canvasRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const x = e.clientX - rect.left + el.scrollLeft;
      const y = e.clientY - rect.top + el.scrollTop;
      setConnecting((prev) =>
        prev ? { ...prev, mouseX: x, mouseY: y } : null,
      );
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setConnecting(null);
    }
    window.addEventListener("mousemove", onMove);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("keydown", onKey);
    };
  }, [connecting]);

  // ---------------------------------------------------------------------
  // Connection actions
  // ---------------------------------------------------------------------
  const startConnection = useCallback(
    (fromItemId: string, e?: React.MouseEvent) => {
      const el = canvasRef.current;
      if (!el || !e) {
        setConnecting({ fromItemId, mouseX: 0, mouseY: 0 });
        return;
      }
      const rect = el.getBoundingClientRect();
      setConnecting({
        fromItemId,
        mouseX: e.clientX - rect.left + el.scrollLeft,
        mouseY: e.clientY - rect.top + el.scrollTop,
      });
    },
    [],
  );

  const finishConnection = useCallback(
    async (toItemId: string) => {
      if (!connecting) return;
      const fromItemId = connecting.fromItemId;
      setConnecting(null);
      if (fromItemId === toItemId) return;
      // Optimistic ID — replaced when realtime returns the real row, but
      // good enough to render immediately.
      const r = await createBoardConnection(
        boardId,
        projectId,
        fromItemId,
        toItemId,
      );
      if (r.ok) {
        setConnections((prev) =>
          prev.some((c) => c.id === r.connection.id)
            ? prev
            : [...prev, r.connection],
        );
      }
    },
    [boardId, projectId, connecting],
  );

  const cancelConnection = useCallback(() => setConnecting(null), []);

  const removeConnection = useCallback(
    async (connId: string) => {
      setConnections((prev) => prev.filter((c) => c.id !== connId));
      await deleteBoardConnection(connId, projectId);
    },
    [projectId],
  );

  // ---------------------------------------------------------------------
  // Add new items
  // ---------------------------------------------------------------------
  const dropPosition = useCallback(() => {
    // Drop in the visible center of the canvas
    if (!canvasRef.current) return { x: 200, y: 200 };
    const scrollTop = canvasRef.current.scrollTop;
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: rect.width / 2 - 120 + Math.random() * 40 - 20,
      y: scrollTop + rect.height / 2 - 90 + Math.random() * 40 - 20,
    };
  }, []);

  async function addNote() {
    const pos = dropPosition();
    const r = await createBoardItem(
      boardId,
      projectId,
      "note",
      { text: "", color: NOTE_COLORS[1]!.hex } satisfies NoteContent,
      pos,
    );
    if (r.ok) setItems((prev) => [...prev, r.item]);
  }

  async function addLink(url: string, title: string) {
    const pos = dropPosition();
    const r = await createBoardItem(
      boardId,
      projectId,
      "link",
      { url, title: title || url } satisfies LinkContent,
      pos,
    );
    if (r.ok) setItems((prev) => [...prev, r.item]);
  }

  async function addTodo() {
    const pos = dropPosition();
    const r = await createBoardItem(
      boardId,
      projectId,
      "todo",
      {
        title: null,
        items: [{ id: crypto.randomUUID(), text: "", done: false }],
      } satisfies TodoContent,
      pos,
    );
    if (r.ok) setItems((prev) => [...prev, r.item]);
  }

  async function addImageFromFile(file: File) {
    setUploadError(null);
    const init = await requestBoardImageUpload(boardId, file.name, file.size);
    if (!init.ok) {
      setUploadError(init.error);
      return;
    }
    const supabase = createBrowserSupabase();
    const { error: upErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .uploadToSignedUrl(init.storagePath, init.token, file);
    if (upErr) {
      setUploadError(upErr.message);
      return;
    }
    const pos = dropPosition();
    const r = await createBoardItem(
      boardId,
      projectId,
      "image",
      {
        storage_path: init.storagePath,
        filename: file.name,
      } satisfies ImageContent,
      pos,
    );
    if (r.ok) setItems((prev) => [...prev, r.item]);
  }

  // ---------------------------------------------------------------------
  // Per-item callbacks given to children
  // ---------------------------------------------------------------------
  const onItemUpdate = useCallback(
    (
      id: string,
      patch: Partial<BoardItem>,
    ): void => {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, ...patch } : it)),
      );
      // Persist only the persistable bits
      const persistable: Parameters<typeof updateBoardItem>[2] = {};
      if ("content" in patch) persistable.content = patch.content as BoardItem["content"];
      if ("width" in patch) persistable.width = patch.width;
      if ("height" in patch) persistable.height = patch.height;
      if (Object.keys(persistable).length > 0) {
        void updateBoardItem(id, projectId, persistable);
      }
    },
    [projectId],
  );

  const onItemDelete = useCallback(
    async (id: string) => {
      setItems((prev) => prev.filter((it) => it.id !== id));
      await deleteBoardItem(id, projectId);
    },
    [projectId],
  );

  return (
    <div className="relative h-full w-full overflow-hidden bg-foreground/[0.015]">
      {/* Toolbar verticale à gauche */}
      <div className="pointer-events-none absolute left-4 top-4 z-30">
        <div className="pointer-events-auto glass-panel flex flex-col gap-1 rounded-2xl p-1.5">
          <ToolbarButton onClick={addNote} icon={<StickyNote className="h-4 w-4" />}>
            Note
          </ToolbarButton>
          <ToolbarButton
            onClick={() => fileInputRef.current?.click()}
            icon={<ImagePlus className="h-4 w-4" />}
          >
            Image
          </ToolbarButton>
          <ToolbarButton
            onClick={() => setLinkOpen(true)}
            icon={<Link2 className="h-4 w-4" />}
          >
            Lien
          </ToolbarButton>
          <ToolbarButton
            onClick={addTodo}
            icon={<ListChecks className="h-4 w-4" />}
          >
            Todo
          </ToolbarButton>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void addImageFromFile(f);
              e.target.value = "";
            }}
          />
        </div>
      </div>

      {uploadError ? (
        <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-md bg-destructive/90 px-3 py-1.5 text-xs text-destructive-foreground">
          {uploadError}
        </div>
      ) : null}

      {connecting ? (
        <div className="absolute left-1/2 top-20 z-30 -translate-x-1/2 rounded-full border border-primary/40 bg-primary/15 px-3 py-1.5 text-xs text-primary backdrop-blur-md">
          Clique sur une carte pour la relier · <kbd className="ml-1">Esc</kbd> pour annuler
        </div>
      ) : null}

      {/* Canvas scrollable */}
      <div
        ref={canvasRef}
        onClick={() => {
          // Click on canvas background cancels a pending connection
          if (connecting) cancelConnection();
        }}
        className="h-full w-full overflow-auto"
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--border) 1px, transparent 0)",
          backgroundSize: "32px 32px",
          cursor: connecting ? "crosshair" : undefined,
        }}
      >
        <div
          ref={contentRef}
          className="relative"
          style={{ width: "200%", minHeight: CANVAS_MIN_HEIGHT }}
        >
          {/* SVG layer for connections (behind cards, but clickable via pointer-events on paths) */}
          <ConnectionsLayer
            items={items}
            connections={connections}
            connecting={connecting}
            onRemove={removeConnection}
          />

          {items.length === 0 ? <EmptyState /> : null}
          {items.map((item) => (
            <BoardItemView
              key={item.id}
              item={item}
              connecting={connecting !== null}
              onMouseDown={(e) => onItemMouseDown(e, item)}
              onClickWhenConnecting={() => finishConnection(item.id)}
              onStartConnection={(e) => startConnection(item.id, e)}
              onUpdate={(patch) => onItemUpdate(item.id, patch)}
              onDelete={() => onItemDelete(item.id)}
              onEditingChange={(editing) =>
                setEditingItem(editing ? item.id : null)
              }
            />
          ))}
        </div>
      </div>

      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <AddLinkDialog
          onAdd={(url, title) => {
            void addLink(url, title);
            setLinkOpen(false);
          }}
        />
      </Dialog>
    </div>
  );
}

function ToolbarButton({
  onClick,
  icon,
  children,
}: {
  onClick: () => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
    >
      {icon}
      <span className="text-left">{children}</span>
    </button>
  );
}

function EmptyState() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="max-w-sm text-center">
        <Plus className="mx-auto h-6 w-6 text-muted-foreground/40" />
        <p className="mt-2 text-sm font-medium text-muted-foreground">
          Espace de création vide
        </p>
        <p className="mt-1 text-xs text-muted-foreground/70">
          Utilise la barre en haut pour ajouter ta première note, image ou
          lien. Tu peux ensuite drag-and-drop pour les organiser.
        </p>
      </div>
    </div>
  );
}

// ============================================================================
// Item views
// ============================================================================

function BoardItemView({
  item,
  connecting,
  onMouseDown,
  onClickWhenConnecting,
  onStartConnection,
  onUpdate,
  onDelete,
  onEditingChange,
}: {
  item: BoardItem;
  connecting: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  onClickWhenConnecting: () => void;
  onStartConnection: (e: React.MouseEvent) => void;
  onUpdate: (patch: Partial<BoardItem>) => void;
  onDelete: () => void;
  onEditingChange: (editing: boolean) => void;
}) {
  return (
    <div
      onMouseDown={connecting ? undefined : onMouseDown}
      className={cn(
        "group/item absolute",
        connecting ? "cursor-crosshair" : "cursor-grab active:cursor-grabbing",
      )}
      style={{
        left: item.position_x,
        top: item.position_y,
        width: item.width,
        height: item.height,
        zIndex: item.z_index,
      }}
    >
      <div className="relative h-full">
        {item.type === "note" ? (
          <NoteView
            item={item}
            onUpdate={onUpdate}
            onEditingChange={onEditingChange}
          />
        ) : null}
        {item.type === "image" ? (
          <ImageView item={item} onUpdate={onUpdate} />
        ) : null}
        {item.type === "link" ? (
          <LinkView
            item={item}
            onUpdate={onUpdate}
            onEditingChange={onEditingChange}
          />
        ) : null}
        {item.type === "todo" ? (
          <TodoView
            item={item}
            onUpdate={onUpdate}
            onEditingChange={onEditingChange}
          />
        ) : null}

        {/* Delete button (hover only, not in connecting mode) */}
        {!connecting ? (
          <button
            type="button"
            data-no-drag
            onClick={onDelete}
            className="absolute -right-2 -top-2 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-border bg-popover text-muted-foreground shadow-md transition-all hover:bg-destructive hover:text-destructive-foreground group-hover/item:flex"
            aria-label="Supprimer"
          >
            <X className="h-3 w-3" />
          </button>
        ) : null}

        {/* Start-connection button (hover only, not in connecting mode) */}
        {!connecting ? (
          <button
            type="button"
            data-no-drag
            onClick={(e) => {
              e.stopPropagation();
              onStartConnection(e);
            }}
            className="absolute -left-2 -top-2 z-10 hidden h-6 w-6 items-center justify-center rounded-full border border-primary/40 bg-popover text-primary shadow-md transition-all hover:bg-primary hover:text-primary-foreground group-hover/item:flex"
            aria-label="Connecter à une autre carte"
            title="Connecter à une autre carte"
          >
            <Spline className="h-3 w-3" />
          </button>
        ) : null}

        {/* Click-target overlay in connecting mode */}
        {connecting ? (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClickWhenConnecting();
            }}
            className="absolute inset-0 z-20 cursor-crosshair rounded-xl bg-primary/5 ring-2 ring-primary/40 transition-all hover:bg-primary/10 hover:ring-primary"
            aria-label="Relier cette carte"
          />
        ) : null}
      </div>
    </div>
  );
}

function ConnectionsLayer({
  items,
  connections,
  connecting,
  onRemove,
}: {
  items: BoardItem[];
  connections: BoardConnection[];
  connecting: { fromItemId: string; mouseX: number; mouseY: number } | null;
  onRemove: (connectionId: string) => void;
}) {
  function pathFor(
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
  ): string {
    const dx = toX - fromX;
    const midX = fromX + dx / 2;
    return `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;
  }

  return (
    <svg
      className="pointer-events-none absolute inset-0"
      style={{ width: "100%", height: "100%" }}
      // No viewBox: paths use raw pixel coords matching item position_x/y.
    >
      <defs>
        <marker
          id="lumen-arrow"
          viewBox="0 0 10 10"
          refX="8"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
        </marker>
      </defs>

      {connections.map((c) => {
        const from = items.find((i) => i.id === c.from_item_id);
        const to = items.find((i) => i.id === c.to_item_id);
        if (!from || !to) return null;
        const fx = from.position_x + from.width / 2;
        const fy = from.position_y + from.height / 2;
        const tx = to.position_x + to.width / 2;
        const ty = to.position_y + to.height / 2;
        const d = pathFor(fx, fy, tx, ty);
        return (
          <g key={c.id} className="text-primary">
            {/* Wide invisible hit area for easier click */}
            <path
              d={d}
              fill="none"
              stroke="transparent"
              strokeWidth={18}
              className="pointer-events-auto cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(c.id);
              }}
            >
              <title>Cliquer pour supprimer le lien</title>
            </path>
            {/* Visible curve */}
            <path
              d={d}
              fill="none"
              stroke="currentColor"
              strokeWidth={1.8}
              markerEnd="url(#lumen-arrow)"
              className="pointer-events-none transition-[stroke-width] hover:stroke-[2.5px]"
            />
          </g>
        );
      })}

      {/* Live dotted preview while drawing a new connection */}
      {connecting ? (() => {
        const from = items.find((i) => i.id === connecting.fromItemId);
        if (!from) return null;
        const fx = from.position_x + from.width / 2;
        const fy = from.position_y + from.height / 2;
        return (
          <path
            d={pathFor(fx, fy, connecting.mouseX, connecting.mouseY)}
            fill="none"
            stroke="oklch(0.65 0.22 258 / 70%)"
            strokeWidth={2}
            strokeDasharray="6 4"
            markerEnd="url(#lumen-arrow)"
            className="text-primary"
          />
        );
      })() : null}
    </svg>
  );
}

function NoteView({
  item,
  onUpdate,
  onEditingChange,
}: {
  item: BoardItem;
  onUpdate: (patch: Partial<BoardItem>) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const content = item.content as NoteContent;
  const [text, setText] = useState(content.text);
  const [editing, setEditing] = useState(false);
  const [showColors, setShowColors] = useState(false);

  // Re-sync local text from props when an other client updates the note
  // and we're not actively editing.
  useEffect(() => {
    if (!editing && content.text !== text) {
      setText(content.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.text, editing]);

  // Debounce save text
  useEffect(() => {
    if (text === content.text) return;
    const t = setTimeout(() => {
      onUpdate({ content: { ...content, text } });
    }, 600);
    return () => clearTimeout(t);
  }, [text, content, onUpdate]);

  function enterEdit() {
    setEditing(true);
    onEditingChange(true);
  }
  function leaveEdit() {
    setEditing(false);
    onEditingChange(false);
  }

  const bg = content.color ?? "var(--card)";

  return (
    <div
      className="relative h-full overflow-hidden rounded-xl border border-foreground/10 p-3 shadow-sm transition-shadow group-hover/item:shadow-lg"
      style={{
        backgroundColor: bg,
        color: content.color ? "#1f2937" : undefined,
      }}
      onDoubleClick={enterEdit}
    >
      {editing ? (
        <textarea
          data-no-drag
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={leaveEdit}
          placeholder="Écris ta note…"
          className="h-full min-h-[120px] w-full resize-none bg-transparent text-sm outline-none placeholder:opacity-50"
          style={{ color: content.color ? "#1f2937" : undefined }}
        />
      ) : (
        <p className="h-full overflow-y-auto whitespace-pre-wrap text-sm">
          {text || (
            <span className="opacity-50">Double-clic pour éditer</span>
          )}
        </p>
      )}

      {/* Color picker */}
      <button
        type="button"
        data-no-drag
        onClick={() => setShowColors((s) => !s)}
        className="absolute bottom-2 right-2 h-5 w-5 rounded-full border border-foreground/20 opacity-0 transition-opacity group-hover/item:opacity-100"
        style={{ backgroundColor: bg }}
        aria-label="Changer la couleur"
      >
        <Palette className="m-auto h-3 w-3" />
      </button>
      {showColors ? (
        <div
          data-no-drag
          className="absolute bottom-9 right-2 flex flex-wrap gap-1 rounded-md border border-foreground/10 bg-popover p-1.5 shadow-md"
        >
          {NOTE_COLORS.map((c) => (
            <button
              key={c.id}
              type="button"
              data-no-drag
              onClick={() => {
                onUpdate({ content: { ...content, color: c.hex } });
                setShowColors(false);
              }}
              className="h-5 w-5 rounded-full border border-foreground/20"
              style={{ backgroundColor: c.hex ?? "var(--card)" }}
              aria-label={c.label}
              title={c.label}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function ImageView({
  item,
  onUpdate,
}: {
  item: BoardItem;
  onUpdate: (patch: Partial<BoardItem>) => void;
}) {
  void onUpdate; // resize will be added later
  const content = item.content as ImageContent;
  const [url, setUrl] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    startTransition(async () => {
      const r = await getBoardImageUrl(content.storage_path);
      if (cancelled) return;
      if (r.ok) setUrl(r.url);
      else setError(r.error);
    });
    return () => {
      cancelled = true;
    };
  }, [content.storage_path]);

  return (
    <div className="relative h-full overflow-hidden rounded-xl border border-foreground/10 bg-foreground/[0.04] shadow-sm transition-shadow group-hover/item:shadow-lg">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={content.alt ?? content.filename}
          className="h-full w-full object-cover"
          draggable={false}
        />
      ) : pending ? (
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-destructive">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function LinkView({
  item,
  onUpdate,
  onEditingChange,
}: {
  item: BoardItem;
  onUpdate: (patch: Partial<BoardItem>) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const content = item.content as LinkContent;
  const initial = content.title ?? content.url;
  const [title, setTitle] = useState(initial);
  const [editing, setEditing] = useState(false);

  // Re-sync local title from props if not editing (Realtime update).
  useEffect(() => {
    if (!editing && initial !== title) {
      setTitle(initial);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initial, editing]);

  useEffect(() => {
    if (title === initial) return;
    const t = setTimeout(() => {
      onUpdate({ content: { ...content, title } });
    }, 600);
    return () => clearTimeout(t);
  }, [title, content, onUpdate, initial]);

  function enterEdit() {
    setEditing(true);
    onEditingChange(true);
  }
  function leaveEdit() {
    setEditing(false);
    onEditingChange(false);
  }

  return (
    <div
      className="flex h-full flex-col rounded-xl border border-foreground/10 bg-popover p-3 shadow-sm transition-shadow group-hover/item:shadow-lg"
      onDoubleClick={enterEdit}
    >
      <div className="mb-1 flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
        <Link2 className="h-3 w-3" />
        Lien
      </div>
      {editing ? (
        <textarea
          data-no-drag
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={leaveEdit}
          className="flex-1 resize-none bg-transparent text-sm font-medium leading-tight outline-none"
        />
      ) : (
        <p className="line-clamp-3 flex-1 text-sm font-medium leading-tight">
          {title || "Double-clic pour titrer"}
        </p>
      )}
      <a
        data-no-drag
        href={content.url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-1.5 inline-flex items-center gap-1 truncate text-[11px] text-primary hover:underline"
      >
        <ExternalLink className="h-3 w-3 shrink-0" />
        {content.url}
      </a>
    </div>
  );
}

function TodoView({
  item,
  onUpdate,
  onEditingChange,
}: {
  item: BoardItem;
  onUpdate: (patch: Partial<BoardItem>) => void;
  onEditingChange: (editing: boolean) => void;
}) {
  const content = item.content as TodoContent;
  const [todos, setTodos] = useState<TodoItem[]>(content.items ?? []);
  const [title, setTitle] = useState(content.title ?? "");
  const [editingTitle, setEditingTitle] = useState(false);

  // Re-sync from props when realtime update arrives and user isn't editing.
  useEffect(() => {
    if (!editingTitle && (content.title ?? "") !== title) {
      setTitle(content.title ?? "");
    }
    // Always sync the items list (Realtime). The check for "user is typing
    // in a specific row" is per-row inside the input via onBlur save.
    setTodos((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(content.items ?? [])) return prev;
      return content.items ?? [];
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.title, content.items, editingTitle]);

  // Debounce save title
  useEffect(() => {
    if ((content.title ?? "") === title) return;
    const t = setTimeout(() => {
      onUpdate({ content: { ...content, title } });
    }, 600);
    return () => clearTimeout(t);
  }, [title, content, onUpdate]);

  function saveTodos(next: TodoItem[]) {
    setTodos(next);
    onUpdate({ content: { ...content, items: next } });
  }

  function toggleDone(id: string) {
    saveTodos(
      todos.map((t) => (t.id === id ? { ...t, done: !t.done } : t)),
    );
  }
  function updateText(id: string, text: string) {
    // Local immediate, debounced server save via separate effect
    setTodos((prev) =>
      prev.map((t) => (t.id === id ? { ...t, text } : t)),
    );
  }
  function commitText(id: string) {
    // Persist on blur
    onUpdate({ content: { ...content, items: todos } });
  }
  function addRow() {
    const next: TodoItem = { id: crypto.randomUUID(), text: "", done: false };
    saveTodos([...todos, next]);
  }
  function removeRow(id: string) {
    saveTodos(todos.filter((t) => t.id !== id));
  }

  const remaining = todos.filter((t) => !t.done).length;

  return (
    <div
      className="flex h-full flex-col overflow-hidden rounded-xl border border-foreground/10 bg-popover p-3 shadow-sm transition-shadow group-hover/item:shadow-lg"
    >
      <div className="mb-1.5 flex items-center justify-between gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <ListChecks className="h-3 w-3" />
          Todo
        </span>
        <span>
          {remaining} / {todos.length}
        </span>
      </div>

      {editingTitle ? (
        <input
          data-no-drag
          autoFocus
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={() => {
            setEditingTitle(false);
            onEditingChange(false);
          }}
          placeholder="Titre de la liste…"
          className="mb-2 w-full bg-transparent text-sm font-medium leading-tight outline-none placeholder:text-muted-foreground/50"
        />
      ) : (
        <button
          type="button"
          data-no-drag
          onClick={() => {
            setEditingTitle(true);
            onEditingChange(true);
          }}
          className="mb-2 truncate text-left text-sm font-medium leading-tight"
        >
          {title || (
            <span className="text-muted-foreground/50">
              Titre de la liste
            </span>
          )}
        </button>
      )}

      <ul className="flex-1 space-y-1 overflow-y-auto">
        {todos.map((t) => (
          <li
            key={t.id}
            className="group/row flex items-start gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-foreground/[0.04]"
          >
            <button
              type="button"
              data-no-drag
              onClick={(e) => {
                e.stopPropagation();
                toggleDone(t.id);
              }}
              className="mt-0.5 shrink-0 text-muted-foreground transition-colors hover:text-primary"
              aria-label={t.done ? "Décocher" : "Cocher"}
            >
              {t.done ? (
                <CheckSquare className="h-3.5 w-3.5 text-primary" />
              ) : (
                <Square className="h-3.5 w-3.5" />
              )}
            </button>
            <input
              data-no-drag
              value={t.text}
              onChange={(e) => updateText(t.id, e.target.value)}
              onFocus={() => onEditingChange(true)}
              onBlur={() => {
                onEditingChange(false);
                commitText(t.id);
              }}
              placeholder="Ajouter une tâche…"
              className={cn(
                "flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground/50",
                t.done && "line-through opacity-60",
              )}
            />
            <button
              type="button"
              data-no-drag
              onClick={(e) => {
                e.stopPropagation();
                removeRow(t.id);
              }}
              className="opacity-0 transition-opacity group-hover/row:opacity-100"
              aria-label="Supprimer la tâche"
            >
              <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        data-no-drag
        onClick={(e) => {
          e.stopPropagation();
          addRow();
        }}
        className="mt-1.5 inline-flex items-center gap-1 self-start rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-foreground/[0.06] hover:text-foreground"
      >
        <Plus className="h-3 w-3" />
        Ajouter
      </button>

      {/* Tiny commit-on-Enter hint kept implicit. */}
      <span className="hidden">{void commitText}</span>
    </div>
  );
}

function AddLinkDialog({
  onAdd,
}: {
  onAdd: (url: string, title: string) => void;
}) {
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    onAdd(trimmed, title.trim());
    setUrl("");
    setTitle("");
  }

  return (
    <DialogContent className="border-foreground/10 sm:max-w-md">
      <DialogHeader>
        <DialogTitle className="font-heading text-2xl font-light">
          Ajouter un lien
        </DialogTitle>
      </DialogHeader>
      <form onSubmit={submit} className="space-y-3">
        <div className="space-y-1.5">
          <Label htmlFor="link-url">URL</Label>
          <Input
            id="link-url"
            type="url"
            required
            autoFocus
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://exemple.com/article"
            className="h-11 bg-foreground/[0.03]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="link-title">Titre (optionnel)</Label>
          <Input
            id="link-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Titre court de la ressource"
            className="h-11 bg-foreground/[0.03]"
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={!url.trim()}>
            Ajouter au board
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

// Silence unused
void Trash2;
