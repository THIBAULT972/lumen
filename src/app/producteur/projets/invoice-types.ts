// Types + constantes pour le module facturation. Hors actions.ts pour la
// règle Next "use server" = exports async-only.

export const INVOICE_STATUSES = [
  "draft",
  "sent",
  "paid",
  "overdue",
  "cancelled",
] as const;
export type InvoiceStatus = (typeof INVOICE_STATUSES)[number];

export type InvoiceLineInput = {
  description: string;
  quantity: number;
  unit_price_cents: number;
  vat_rate: number; // %
};

export type InvoicePayload = {
  issued_at: string; // YYYY-MM-DD
  due_at: string | null; // YYYY-MM-DD
  notes: string | null;
  lines: InvoiceLineInput[];
};

export type InvoiceLineRow = InvoiceLineInput & {
  id: string;
  invoice_id: string;
  order_index: number;
  total_ht_cents: number;
  total_ttc_cents: number;
};

export type InvoiceRow = {
  id: string;
  project_id: string;
  number: string;
  status: InvoiceStatus;
  issued_at: string;
  due_at: string | null;
  paid_at: string | null;
  studio_snapshot: Record<string, unknown>;
  client_snapshot: Record<string, unknown>;
  notes: string | null;
  total_ht_cents: number;
  total_tva_cents: number;
  total_ttc_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
  lines?: InvoiceLineRow[];
};
