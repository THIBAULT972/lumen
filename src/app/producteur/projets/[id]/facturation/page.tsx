import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, FileText, Pencil, MapPin, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import type { InvoiceRow, InvoiceStatus } from "../../invoice-types";
import { FacturationManager } from "./facturation-manager";

export default async function FacturationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, client_id")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  if (!project.client_id) {
    return (
      <div className="space-y-4">
        <Link
          href={`/producteur/projets/${project.id}`}
          className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Retour au projet
        </Link>
        <div className="glass-panel rounded-2xl p-10 text-center">
          <FileText className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-4 font-heading text-xl font-light">
            Pas de client rattaché
          </p>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
            La facturation n'est disponible que pour les projets liés à un
            client. Édite ce projet et passe-le en type « Client » d'abord.
          </p>
        </div>
      </div>
    );
  }

  const [client, clientProfileRes, invoicesRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, first_name, last_name, email")
      .eq("id", project.client_id)
      .maybeSingle(),
    supabase
      .from("client_profiles")
      .select(
        "company_name, legal_form, address_line1, address_line2, postal_code, city, country, siret, vat_number, phone, contact_name",
      )
      .eq("id", project.client_id)
      .maybeSingle(),
    supabase
      .from("invoices")
      .select(
        "id, project_id, number, status, issued_at, due_at, paid_at, studio_snapshot, client_snapshot, notes, total_ht_cents, total_tva_cents, total_ttc_cents, currency, created_at, updated_at",
      )
      .eq("project_id", project.id)
      .order("created_at", { ascending: false }),
  ]);

  const accountName = client.data
    ? [client.data.first_name, client.data.last_name].filter(Boolean).join(" ") ||
      client.data.email
    : "Client";
  const cp = clientProfileRes.data;
  const billingName = cp?.company_name?.trim() || accountName;
  const hasAddress = Boolean(
    cp?.address_line1 || cp?.postal_code || cp?.city,
  );

  const invoices: InvoiceRow[] = (invoicesRes.data ?? []).map((i) => ({
    ...(i as InvoiceRow),
    status: i.status as InvoiceStatus,
  }));

  return (
    <>
      <Link
        href={`/producteur/projets/${project.id}`}
        className="mb-4 inline-flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        Retour au projet
      </Link>

      <section className="mb-8">
        <p className="text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
          Studio · Facturation
        </p>
        <h1 className="mt-2 font-heading text-3xl font-light tracking-tight sm:text-4xl">
          {project.name}{" "}
          <span className="text-muted-foreground">· Factures</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Client : <span className="text-foreground">{billingName}</span>
        </p>
      </section>

      {/* Panel infos client */}
      <section className="mb-8 glass-panel rounded-2xl p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground">
              Infos de facturation du client
            </p>
            <div className="mt-2 grid gap-3 sm:grid-cols-2">
              <div>
                <p className="font-heading text-base font-medium">
                  {billingName}
                  {cp?.legal_form ? (
                    <span className="ml-1.5 text-xs font-light text-muted-foreground">
                      ({cp.legal_form})
                    </span>
                  ) : null}
                </p>
                {cp?.contact_name && cp.contact_name !== billingName ? (
                  <p className="text-xs text-muted-foreground">
                    Contact : {cp.contact_name}
                  </p>
                ) : null}
                <p className="mt-1 text-xs text-muted-foreground">
                  {client.data?.email ?? ""}
                </p>
                {cp?.phone ? (
                  <p className="text-xs text-muted-foreground">{cp.phone}</p>
                ) : null}
              </div>
              <div className="text-sm">
                {hasAddress ? (
                  <div className="flex items-start gap-2 text-muted-foreground">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <div>
                      {cp?.address_line1 ? <p>{cp.address_line1}</p> : null}
                      {cp?.address_line2 ? <p>{cp.address_line2}</p> : null}
                      <p>
                        {[cp?.postal_code, cp?.city].filter(Boolean).join(" ")}
                      </p>
                      {cp?.country ? <p>{cp.country}</p> : null}
                    </div>
                  </div>
                ) : (
                  <p className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-300">
                    <AlertCircle className="h-3.5 w-3.5" />
                    Aucune adresse renseignée — l'adresse manquera sur le PDF.
                  </p>
                )}
                {cp?.siret || cp?.vat_number ? (
                  <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                    {cp.siret ? <p>SIRET : {cp.siret}</p> : null}
                    {cp.vat_number ? <p>N° TVA : {cp.vat_number}</p> : null}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <Link
            href="/producteur/equipe"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-foreground/15 bg-foreground/[0.04] px-3 text-xs font-medium transition-colors hover:bg-foreground/[0.08]"
          >
            <Pencil className="h-3 w-3" />
            Modifier dans Équipe
          </Link>
        </div>
      </section>

      <FacturationManager
        projectId={project.id}
        clientName={billingName}
        invoices={invoices}
      />
    </>
  );
}
