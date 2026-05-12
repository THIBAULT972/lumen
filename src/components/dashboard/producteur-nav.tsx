"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, Tags, FolderOpen, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/producteur", label: "Vue d'ensemble", icon: LayoutDashboard, exact: true },
  { href: "/producteur/equipe", label: "Équipe", icon: Users },
  { href: "/producteur/competences", label: "Compétences", icon: Tags },
  { href: "/producteur/projets", label: "Projets", icon: FolderOpen },
  { href: "/producteur/calendrier", label: "Calendrier", icon: Calendar, disabled: true },
];

export function ProducteurNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto pb-0">
      {links.map(({ href, label, icon: Icon, exact, disabled }) => {
        const active = exact ? pathname === href : pathname.startsWith(href);
        if (disabled) {
          return (
            <span
              key={href}
              aria-disabled="true"
              className="inline-flex cursor-not-allowed items-center gap-2 border-b-2 border-transparent px-4 py-3 text-sm text-muted-foreground/30"
              title="À venir"
            >
              <Icon className="h-4 w-4" />
              {label}
            </span>
          );
        }
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              "inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm transition-colors",
              active
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:border-foreground/30 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
