/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import type { ReactElement } from "react";
import { STUDIO_INFO, type StudioInfoSnapshot } from "@/lib/studio-info";
import type { InvoiceRow } from "@/app/producteur/projets/invoice-types";

// ─── Style (sobre, imprimable, accents LUMEN bleu/violet) ──────────────────

const NEON_BLUE = "#3b5cf6";
const NEON_VIOLET = "#8b5cf6";
const INK = "#0f1117";
const MUTED = "#6b7280";
const LINE = "#e5e7eb";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 9,
    fontFamily: "Helvetica",
    color: INK,
    backgroundColor: "#ffffff",
  },
  // Top neon bar (la patte LUMEN)
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    flexDirection: "row",
  },
  topBarSeg1: { flex: 1, backgroundColor: NEON_BLUE },
  topBarSeg2: { flex: 1, backgroundColor: NEON_VIOLET },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 30,
  },
  brand: {
    fontSize: 28,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 2,
    color: INK,
  },
  brandTag: {
    fontSize: 8,
    color: MUTED,
    marginTop: 2,
    letterSpacing: 1,
    textTransform: "uppercase",
  },
  invoiceMeta: {
    alignItems: "flex-end",
  },
  invoiceLabel: {
    fontSize: 8,
    color: MUTED,
    letterSpacing: 1.5,
    textTransform: "uppercase",
  },
  invoiceNumber: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
    letterSpacing: 1,
  },
  invoiceStatus: {
    fontSize: 8,
    marginTop: 4,
    padding: "2 8",
    borderRadius: 10,
  },

  parties: {
    flexDirection: "row",
    gap: 30,
    marginBottom: 28,
  },
  party: {
    flex: 1,
    padding: 12,
    borderRadius: 4,
    backgroundColor: "#f9fafb",
    borderLeft: `2pt solid ${NEON_BLUE}`,
  },
  partyClient: {
    borderLeftColor: NEON_VIOLET,
  },
  partyLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  partyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginBottom: 2,
  },
  partyLine: {
    fontSize: 8,
    color: INK,
    marginTop: 1,
    lineHeight: 1.4,
  },
  partyLineMuted: {
    fontSize: 8,
    color: MUTED,
    marginTop: 1,
  },

  dates: {
    flexDirection: "row",
    gap: 14,
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  dateBox: {},
  dateLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  dateValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginTop: 2,
  },

  table: {
    marginTop: 8,
    marginBottom: 10,
  },
  tableHead: {
    flexDirection: "row",
    backgroundColor: INK,
    color: "#ffffff",
    padding: "6 8",
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  tableRow: {
    flexDirection: "row",
    padding: "8 8",
    borderBottom: `0.5pt solid ${LINE}`,
  },
  colDescription: { flex: 5 },
  colQty: { flex: 1, textAlign: "right" },
  colUnit: { flex: 1.5, textAlign: "right" },
  colVat: { flex: 1, textAlign: "right" },
  colTotal: { flex: 1.5, textAlign: "right" },

  totalsWrap: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
  },
  totals: {
    width: 240,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: "4 8",
  },
  totalLabel: {
    fontSize: 9,
    color: MUTED,
  },
  totalValue: {
    fontSize: 9,
    fontFamily: "Helvetica-Bold",
  },
  totalRowGrand: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    padding: "8 8",
    backgroundColor: INK,
    color: "#ffffff",
    borderRadius: 4,
  },
  totalGrandLabel: {
    color: "#ffffff",
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 0.5,
  },
  totalGrandValue: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
  },

  vatNotice: {
    marginTop: 18,
    padding: 8,
    borderRadius: 4,
    backgroundColor: "#fef3c7",
    borderLeft: "2pt solid #f59e0b",
    fontSize: 8,
    color: "#92400e",
  },

  notes: {
    marginTop: 14,
    padding: 8,
    borderRadius: 4,
    backgroundColor: "#f9fafb",
    fontSize: 8,
    color: INK,
  },
  notesLabel: {
    fontSize: 7,
    color: MUTED,
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },

  footer: {
    position: "absolute",
    bottom: 24,
    left: 40,
    right: 40,
    paddingTop: 10,
    borderTop: `0.5pt solid ${LINE}`,
    flexDirection: "row",
    justifyContent: "space-between",
    fontSize: 7,
    color: MUTED,
  },
  footerCol: {
    flex: 1,
  },
  footerLabel: {
    textTransform: "uppercase",
    letterSpacing: 1,
    fontSize: 6,
    color: MUTED,
    marginBottom: 1,
  },
  footerValue: {
    fontSize: 8,
    color: INK,
    lineHeight: 1.4,
  },
});

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Formate un montant en euros pour le PDF.
 *
 * On n'utilise PAS Intl.NumberFormat ici car la locale fr-FR insère un narrow
 * no-break space (U+202F) que Helvetica (police par défaut de @react-pdf)
 * rend en glyphe absent — visuellement un slash ou un carré. On formate à la
 * main avec des espaces classiques (U+0020) pour avoir un rendu propre.
 */
function euros(cents: number): string {
  const isNeg = cents < 0;
  const abs = Math.abs(cents);
  const intPart = Math.floor(abs / 100);
  const decPart = abs % 100;
  const intStr = intPart.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const decStr = decPart.toString().padStart(2, "0");
  return `${isNeg ? "-" : ""}${intStr},${decStr} €`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", {
    timeZone: "America/Martinique",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/**
 * Renvoie le badge à afficher sur le PDF, ou `null` si aucun marquage n'est
 * pertinent (cas des brouillons et factures simplement « émises » : pas la
 * peine d'écrire "ÉMISE" sur une facture qui est, par construction, une
 * facture émise).
 */
function statusFr(
  status: string,
): { label: string; color: string } | null {
  switch (status) {
    case "draft":
      return null; // pas de marquage "BROUILLON" sur le PDF
    case "sent":
      return null; // une facture émise n'a pas besoin de le dire
    case "paid":
      return { label: "PAYÉE", color: "#059669" };
    case "overdue":
      return { label: "EN RETARD", color: "#dc2626" };
    case "cancelled":
      return { label: "ANNULÉE", color: MUTED };
    default:
      return null;
  }
}

// ─── Client snapshot ──────────────────────────────────────────────────────

export type InvoiceClient = {
  name: string;
  contact_name?: string | null;
  legal_form?: string | null;
  email?: string | null;
  phone?: string | null;
  address_line1?: string | null;
  address_line2?: string | null;
  postal_code?: string | null;
  city?: string | null;
  country?: string | null;
  siret?: string | null;
  vat_number?: string | null;
};

// ─── PDF Document ──────────────────────────────────────────────────────────

export function InvoicePDF({
  invoice,
  studio,
  client,
}: {
  invoice: InvoiceRow;
  studio: StudioInfoSnapshot;
  client: InvoiceClient;
}): ReactElement {
  const status = statusFr(invoice.status);

  return (
    <Document
      title={`Facture ${invoice.number}`}
      author={studio.legalName}
      subject={`Facture ${invoice.number}`}
    >
      <Page size="A4" style={styles.page}>
        {/* Neon top bar */}
        <View style={styles.topBar}>
          <View style={styles.topBarSeg1} />
          <View style={styles.topBarSeg2} />
        </View>

        {/* Header brand + invoice meta */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{studio.brandName}</Text>
            <Text style={styles.brandTag}>{studio.brandTagline}</Text>
          </View>
          <View style={styles.invoiceMeta}>
            <Text style={styles.invoiceLabel}>Facture</Text>
            <Text style={styles.invoiceNumber}>{invoice.number}</Text>
            {status ? (
              <Text
                style={{
                  ...styles.invoiceStatus,
                  color: status.color,
                  borderColor: status.color,
                  borderWidth: 1,
                }}
              >
                {status.label}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Parties */}
        <View style={styles.parties}>
          <View style={styles.party}>
            <Text style={styles.partyLabel}>Émetteur</Text>
            <Text style={styles.partyName}>
              {studio.legalName} ({studio.legalForm})
            </Text>
            <Text style={styles.partyLine}>{studio.address.line1}</Text>
            <Text style={styles.partyLine}>
              {studio.address.postalCode} {studio.address.city}
            </Text>
            <Text style={styles.partyLine}>{studio.address.country}</Text>
            <Text style={styles.partyLineMuted}>SIREN : {studio.siren}</Text>
            <Text style={styles.partyLineMuted}>RCS : {studio.rcs}</Text>
            <Text style={styles.partyLineMuted}>RM : {studio.rm}</Text>
          </View>
          <View style={[styles.party, styles.partyClient]}>
            <Text style={styles.partyLabel}>Client</Text>
            <Text style={styles.partyName}>
              {client.name}
              {client.legal_form ? ` (${client.legal_form})` : ""}
            </Text>
            {client.contact_name && client.contact_name !== client.name ? (
              <Text style={styles.partyLine}>{client.contact_name}</Text>
            ) : null}
            {client.address_line1 ? (
              <Text style={styles.partyLine}>{client.address_line1}</Text>
            ) : null}
            {client.address_line2 ? (
              <Text style={styles.partyLine}>{client.address_line2}</Text>
            ) : null}
            {client.postal_code || client.city ? (
              <Text style={styles.partyLine}>
                {[client.postal_code, client.city].filter(Boolean).join(" ")}
              </Text>
            ) : null}
            {client.country ? (
              <Text style={styles.partyLine}>{client.country}</Text>
            ) : null}
            {client.email ? (
              <Text style={styles.partyLineMuted}>{client.email}</Text>
            ) : null}
            {client.phone ? (
              <Text style={styles.partyLineMuted}>{client.phone}</Text>
            ) : null}
            {client.siret ? (
              <Text style={styles.partyLineMuted}>SIRET : {client.siret}</Text>
            ) : null}
            {client.vat_number ? (
              <Text style={styles.partyLineMuted}>
                TVA : {client.vat_number}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Dates */}
        <View style={styles.dates}>
          <View style={styles.dateBox}>
            <Text style={styles.dateLabel}>Date d'émission</Text>
            <Text style={styles.dateValue}>{formatDate(invoice.issued_at)}</Text>
          </View>
          {invoice.due_at ? (
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>Échéance</Text>
              <Text style={styles.dateValue}>{formatDate(invoice.due_at)}</Text>
            </View>
          ) : null}
          {invoice.paid_at ? (
            <View style={styles.dateBox}>
              <Text style={styles.dateLabel}>Payée le</Text>
              <Text style={[styles.dateValue, { color: "#059669" }]}>
                {formatDate(invoice.paid_at)}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Table */}
        <View style={styles.table}>
          <View style={styles.tableHead}>
            <Text style={styles.colDescription}>Description</Text>
            <Text style={styles.colQty}>Qté</Text>
            <Text style={styles.colUnit}>PU HT</Text>
            <Text style={styles.colVat}>TVA</Text>
            <Text style={styles.colTotal}>Total HT</Text>
          </View>
          {(invoice.lines ?? []).map((line) => (
            <View key={line.id} style={styles.tableRow}>
              <Text style={styles.colDescription}>{line.description}</Text>
              <Text style={styles.colQty}>{Number(line.quantity)}</Text>
              <Text style={styles.colUnit}>{euros(line.unit_price_cents)}</Text>
              <Text style={styles.colVat}>{Number(line.vat_rate)}%</Text>
              <Text style={styles.colTotal}>{euros(line.total_ht_cents)}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={styles.totalsWrap}>
          <View style={styles.totals}>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Sous-total HT</Text>
              <Text style={styles.totalValue}>
                {euros(invoice.total_ht_cents)}
              </Text>
            </View>
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>TVA</Text>
              <Text style={styles.totalValue}>
                {euros(invoice.total_tva_cents)}
              </Text>
            </View>
            <View style={styles.totalRowGrand}>
              <Text style={styles.totalGrandLabel}>TOTAL TTC</Text>
              <Text style={styles.totalGrandValue}>
                {euros(invoice.total_ttc_cents)}
              </Text>
            </View>
          </View>
        </View>

        {/* VAT notice (293B) */}
        <Text style={styles.vatNotice}>{studio.vatNotice}</Text>

        {/* Notes */}
        {invoice.notes ? (
          <View style={styles.notes}>
            <Text style={styles.notesLabel}>Notes</Text>
            <Text>{invoice.notes}</Text>
          </View>
        ) : null}

        {/* Footer with payment info */}
        <View style={styles.footer}>
          <View style={styles.footerCol}>
            <Text style={styles.footerLabel}>Paiement par virement</Text>
            <Text style={styles.footerValue}>IBAN : {studio.iban}</Text>
            <Text style={styles.footerValue}>BIC : {studio.bic}</Text>
          </View>
          <View style={styles.footerCol}>
            <Text style={styles.footerLabel}>Émetteur</Text>
            <Text style={styles.footerValue}>{studio.legalName}</Text>
            <Text style={styles.footerValue}>SIREN {studio.siren}</Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}

/**
 * Generates the invoice PDF as a Buffer (Node Buffer). Server-side only.
 *
 * Uses the invoice's `studio_snapshot` so historical invoices keep the
 * legal info they had at emission time (not the current value).
 */
export async function renderInvoicePdfBuffer(
  invoice: InvoiceRow,
  fallback: { clientName?: string; clientEmail?: string } = {},
): Promise<Buffer> {
  const studio = (
    invoice.studio_snapshot && Object.keys(invoice.studio_snapshot).length > 0
      ? invoice.studio_snapshot
      : STUDIO_INFO
  ) as StudioInfoSnapshot;

  // Le snapshot est figé à la création (ou refresh à l'update tant que c'est
  // un brouillon). Fallback sur le nom/email passés par le caller si jamais
  // le snapshot est vide (ancienne facture migrée par ex.).
  const snap = (invoice.client_snapshot ?? {}) as Record<string, unknown>;
  const get = (k: string) => {
    const v = snap[k];
    return typeof v === "string" && v.trim().length > 0 ? v : null;
  };
  const client: InvoiceClient = {
    name: get("name") ?? fallback.clientName ?? "Client",
    contact_name: get("contact_name"),
    legal_form: get("legal_form"),
    email: get("email") ?? fallback.clientEmail ?? null,
    phone: get("phone"),
    address_line1: get("address_line1"),
    address_line2: get("address_line2"),
    postal_code: get("postal_code"),
    city: get("city"),
    country: get("country"),
    siret: get("siret"),
    vat_number: get("vat_number"),
  };

  const element = (
    <InvoicePDF invoice={invoice} studio={studio} client={client} />
  );

  // renderToBuffer is server-only (Node).
  return renderToBuffer(element);
}
