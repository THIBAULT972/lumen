"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProducteur } from "@/lib/auth/guard";
import { STUDIO_INFO } from "@/lib/studio-info";
import type {
  InvoiceLineInput,
  InvoicePayload,
  InvoiceRow,
  InvoiceStatus,
} from "./invoice-types";

type Result<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

// ----------------------------------------------------------------------------
// Calcul des totaux
// ----------------------------------------------------------------------------

function computeLineTotals(line: InvoiceLineInput) {
  const qty = Math.max(0, Number(line.quantity) || 0);
  const unit = Math.max(0, Math.round(Number(line.unit_price_cents) || 0));
  const vatRate = Math.max(0, Number(line.vat_rate) || 0);
  const ht = Math.round(qty * unit);
  const tva = Math.round(ht * (vatRate / 100));
  const ttc = ht + tva;
  return { ht, tva, ttc };
}

function computeInvoiceTotals(lines: InvoiceLineInput[]) {
  let totalHt = 0;
  let totalTva = 0;
  for (const l of lines) {
    const t = computeLineTotals(l);
    totalHt += t.ht;
    totalTva += t.tva;
  }
  return {
    total_ht_cents: totalHt,
    total_tva_cents: totalTva,
    total_ttc_cents: totalHt + totalTva,
  };
}

type ClientProfileLite = {
  company_name: string | null;
  legal_form: string | null;
  address_line1: string | null;
  address_line2: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
  siret: string | null;
  vat_number: string | null;
  phone: string | null;
  contact_name: string | null;
};

function buildClientSnapshot(
  client: {
    email: string;
    first_name?: string | null;
    last_name?: string | null;
  } | null,
  profile: ClientProfileLite | null,
) {
  if (!client) return {};
  const accountName =
    [client.first_name, client.last_name].filter(Boolean).join(" ").trim() ||
    client.email;
  return {
    // Fallback : si pas de raison sociale, on facture le nom du compte.
    name: profile?.company_name?.trim() || accountName,
    contact_name: profile?.contact_name?.trim() || accountName,
    legal_form: profile?.legal_form ?? null,
    email: client.email,
    phone: profile?.phone ?? null,
    address_line1: profile?.address_line1 ?? null,
    address_line2: profile?.address_line2 ?? null,
    postal_code: profile?.postal_code ?? null,
    city: profile?.city ?? null,
    country: profile?.country ?? null,
    siret: profile?.siret ?? null,
    vat_number: profile?.vat_number ?? null,
  };
}

// ----------------------------------------------------------------------------
// Create
// ----------------------------------------------------------------------------

export async function createInvoice(
  projectId: string,
  payload: InvoicePayload,
): Promise<Result<{ invoiceId: string; number: string }>> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  if (!payload.issued_at) {
    return { ok: false, error: "Date d'émission requise." };
  }
  if (!payload.lines || payload.lines.length === 0) {
    return { ok: false, error: "Ajoute au moins une ligne." };
  }

  const admin = createAdminClient();

  // Vérifie le projet et récupère le client snapshot
  const { data: project, error: projErr } = await admin
    .from("projects")
    .select("id, client_id, name")
    .eq("id", projectId)
    .maybeSingle();
  if (projErr || !project) return { ok: false, error: "Projet introuvable." };
  if (!project.client_id) {
    return {
      ok: false,
      error: "Seuls les projets avec un client rattaché peuvent être facturés.",
    };
  }

  const [{ data: client }, { data: clientProfile }] = await Promise.all([
    admin
      .from("profiles")
      .select("email, first_name, last_name")
      .eq("id", project.client_id)
      .maybeSingle(),
    admin
      .from("client_profiles")
      .select(
        "company_name, legal_form, address_line1, address_line2, postal_code, city, country, siret, vat_number, phone, contact_name",
      )
      .eq("id", project.client_id)
      .maybeSingle(),
  ]);

  // Génère le numéro via la fonction SQL
  const { data: numberRow, error: numErr } = await admin
    .rpc("next_invoice_number")
    .single();
  if (numErr || !numberRow) {
    return {
      ok: false,
      error: numErr?.message ?? "Impossible de générer le numéro.",
    };
  }
  const number = String(numberRow);

  const totals = computeInvoiceTotals(payload.lines);

  // Insert header
  const { data: invoice, error: invErr } = await admin
    .from("invoices")
    .insert({
      project_id: projectId,
      number,
      status: "draft" as InvoiceStatus,
      issued_at: payload.issued_at,
      due_at: payload.due_at || null,
      studio_snapshot: STUDIO_INFO,
      client_snapshot: buildClientSnapshot(client, clientProfile),
      notes: payload.notes?.trim() || null,
      total_ht_cents: totals.total_ht_cents,
      total_tva_cents: totals.total_tva_cents,
      total_ttc_cents: totals.total_ttc_cents,
      created_by: guard.user.id,
    })
    .select("id, number")
    .single();
  if (invErr || !invoice) {
    return { ok: false, error: invErr?.message ?? "Erreur création facture." };
  }

  // Insert lines
  const lineRows = payload.lines.map((l, idx) => {
    const t = computeLineTotals(l);
    return {
      invoice_id: invoice.id,
      description: l.description.trim(),
      quantity: l.quantity,
      unit_price_cents: Math.round(l.unit_price_cents),
      vat_rate: l.vat_rate,
      order_index: idx,
      total_ht_cents: t.ht,
      total_ttc_cents: t.ttc,
    };
  });
  const { error: linesErr } = await admin
    .from("invoice_lines")
    .insert(lineRows);
  if (linesErr) {
    await admin.from("invoices").delete().eq("id", invoice.id);
    return { ok: false, error: linesErr.message };
  }

  revalidatePath(`/producteur/projets/${projectId}/facturation`);
  revalidatePath(`/producteur/projets/${projectId}`);
  return { ok: true, invoiceId: invoice.id, number: invoice.number };
}

// ----------------------------------------------------------------------------
// Update (édition d'une facture, possible tant que pas envoyée)
// ----------------------------------------------------------------------------

export async function updateInvoice(
  invoiceId: string,
  projectId: string,
  payload: InvoicePayload,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;

  if (!payload.issued_at)
    return { ok: false, error: "Date d'émission requise." };
  if (!payload.lines || payload.lines.length === 0)
    return { ok: false, error: "Ajoute au moins une ligne." };

  const admin = createAdminClient();

  const { data: existing, error: exErr } = await admin
    .from("invoices")
    .select("status, project_id")
    .eq("id", invoiceId)
    .maybeSingle();
  if (exErr || !existing) return { ok: false, error: "Facture introuvable." };
  if (existing.status !== "draft") {
    return {
      ok: false,
      error:
        "Cette facture a déjà été envoyée. Annule-la puis recrée une nouvelle facture si besoin.",
    };
  }

  // Rafraîchit le snapshot client à chaque update du brouillon : si le
  // producteur a corrigé l'adresse entre temps, la facture suit.
  const { data: project } = await admin
    .from("projects")
    .select("client_id")
    .eq("id", existing.project_id)
    .maybeSingle();
  const clientId = project?.client_id ?? null;
  const [{ data: client }, { data: clientProfile }] = clientId
    ? await Promise.all([
        admin
          .from("profiles")
          .select("email, first_name, last_name")
          .eq("id", clientId)
          .maybeSingle(),
        admin
          .from("client_profiles")
          .select(
            "company_name, legal_form, address_line1, address_line2, postal_code, city, country, siret, vat_number, phone, contact_name",
          )
          .eq("id", clientId)
          .maybeSingle(),
      ])
    : [{ data: null }, { data: null }];

  const totals = computeInvoiceTotals(payload.lines);

  const { error: upErr } = await admin
    .from("invoices")
    .update({
      issued_at: payload.issued_at,
      due_at: payload.due_at || null,
      notes: payload.notes?.trim() || null,
      studio_snapshot: STUDIO_INFO,
      client_snapshot: buildClientSnapshot(client, clientProfile),
      total_ht_cents: totals.total_ht_cents,
      total_tva_cents: totals.total_tva_cents,
      total_ttc_cents: totals.total_ttc_cents,
    })
    .eq("id", invoiceId);
  if (upErr) return { ok: false, error: upErr.message };

  // Replace lines
  await admin.from("invoice_lines").delete().eq("invoice_id", invoiceId);
  const lineRows = payload.lines.map((l, idx) => {
    const t = computeLineTotals(l);
    return {
      invoice_id: invoiceId,
      description: l.description.trim(),
      quantity: l.quantity,
      unit_price_cents: Math.round(l.unit_price_cents),
      vat_rate: l.vat_rate,
      order_index: idx,
      total_ht_cents: t.ht,
      total_ttc_cents: t.ttc,
    };
  });
  const { error: lErr } = await admin.from("invoice_lines").insert(lineRows);
  if (lErr) return { ok: false, error: lErr.message };

  revalidatePath(`/producteur/projets/${projectId}/facturation`);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Transitions de statut
// ----------------------------------------------------------------------------

export async function markInvoiceSent(
  invoiceId: string,
  projectId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ status: "sent" as InvoiceStatus })
    .eq("id", invoiceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/producteur/projets/${projectId}/facturation`);
  revalidatePath("/client");
  return { ok: true };
}

export async function markInvoicePaid(
  invoiceId: string,
  projectId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({
      status: "paid" as InvoiceStatus,
      paid_at: new Date().toISOString().slice(0, 10),
    })
    .eq("id", invoiceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/producteur/projets/${projectId}/facturation`);
  revalidatePath("/client");
  return { ok: true };
}

export async function cancelInvoice(
  invoiceId: string,
  projectId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  const { error } = await admin
    .from("invoices")
    .update({ status: "cancelled" as InvoiceStatus, paid_at: null })
    .eq("id", invoiceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/producteur/projets/${projectId}/facturation`);
  revalidatePath("/client");
  return { ok: true };
}

export async function deleteInvoice(
  invoiceId: string,
  projectId: string,
): Promise<Result> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();
  // Hard delete only for drafts. For others, prefer "cancelled" to keep history.
  const { data: row } = await admin
    .from("invoices")
    .select("status")
    .eq("id", invoiceId)
    .maybeSingle();
  if (row?.status && row.status !== "draft") {
    return {
      ok: false,
      error:
        "Seuls les brouillons peuvent être supprimés. Pour une facture envoyée, utilise 'Annuler'.",
    };
  }
  const { error } = await admin.from("invoices").delete().eq("id", invoiceId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/producteur/projets/${projectId}/facturation`);
  return { ok: true };
}

// ----------------------------------------------------------------------------
// Read (avec lines) — utilisé par la UI producteur et la génération PDF
// ----------------------------------------------------------------------------

export async function getInvoiceWithLines(
  invoiceId: string,
): Promise<Result<{ invoice: InvoiceRow }>> {
  const guard = await getProducteur();
  if (!guard.ok) return guard;
  const admin = createAdminClient();

  const { data: invoice, error } = await admin
    .from("invoices")
    .select(
      "id, project_id, number, status, issued_at, due_at, paid_at, studio_snapshot, client_snapshot, notes, total_ht_cents, total_tva_cents, total_ttc_cents, currency, created_at, updated_at",
    )
    .eq("id", invoiceId)
    .single();
  if (error || !invoice) return { ok: false, error: "Facture introuvable." };

  const { data: lines } = await admin
    .from("invoice_lines")
    .select(
      "id, invoice_id, description, quantity, unit_price_cents, vat_rate, order_index, total_ht_cents, total_ttc_cents",
    )
    .eq("invoice_id", invoiceId)
    .order("order_index", { ascending: true });

  return {
    ok: true,
    invoice: {
      ...(invoice as InvoiceRow),
      lines: (lines ?? []) as InvoiceRow["lines"],
    },
  };
}
