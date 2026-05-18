import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { renderInvoicePdfBuffer } from "@/lib/invoice-pdf";
import type {
  InvoiceRow,
  InvoiceStatus,
} from "@/app/producteur/projets/invoice-types";

/**
 * GET /api/invoices/[id]/pdf — streams the invoice PDF.
 *
 * Auth: the caller must have read access on the row via RLS — i.e. either
 * a producteur assigned to the project, or the client of the project (and
 * the invoice must not be a draft).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Non authentifié." }, { status: 401 });
  }

  // RLS-scoped read to enforce access
  const { data: rls, error: rlsErr } = await supabase
    .from("invoices")
    .select("id")
    .eq("id", id)
    .maybeSingle();
  if (rlsErr || !rls) {
    return NextResponse.json(
      { error: "Facture introuvable ou inaccessible." },
      { status: 404 },
    );
  }

  // Full read with admin (we already enforced access above).
  const admin = createAdminClient();
  const { data: invRow, error: invErr } = await admin
    .from("invoices")
    .select(
      "id, project_id, number, status, issued_at, due_at, paid_at, studio_snapshot, client_snapshot, notes, total_ht_cents, total_tva_cents, total_ttc_cents, currency, created_at, updated_at",
    )
    .eq("id", id)
    .single();
  if (invErr || !invRow) {
    return NextResponse.json({ error: "Erreur DB." }, { status: 500 });
  }

  const { data: lines } = await admin
    .from("invoice_lines")
    .select(
      "id, invoice_id, description, quantity, unit_price_cents, vat_rate, order_index, total_ht_cents, total_ttc_cents",
    )
    .eq("invoice_id", id)
    .order("order_index", { ascending: true });

  const invoice: InvoiceRow = {
    ...(invRow as InvoiceRow),
    status: invRow.status as InvoiceStatus,
    lines: (lines ?? []) as InvoiceRow["lines"],
  };

  // Fallback name/email (le composant lit en priorité le snapshot complet)
  const snap = invoice.client_snapshot as {
    name?: string;
    email?: string;
  } | null;
  const pdf = await renderInvoicePdfBuffer(invoice, {
    clientName: snap?.name ?? "Client",
    clientEmail: snap?.email,
  });

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.number}.pdf"`,
      "Cache-Control": "private, max-age=60",
    },
  });
}
