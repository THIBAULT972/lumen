import type { ReactNode } from "react";
import { Sparkles } from "lucide-react";
import { BackgroundOrbs } from "@/components/background-orbs";
import { signOut } from "@/app/actions/auth";

export type DashboardShellProps = {
  role: "Producteur" | "Prestataire" | "Client";
  userName: string;
  /** Optional nav slot rendered below the top bar (e.g. role-specific tabs). */
  nav?: ReactNode;
  children: ReactNode;
};

/**
 * Common chrome shared by every role's dashboard: top bar with LUMEN brand,
 * role pill, user name, sign-out, plus the animated background.
 */
export function DashboardShell({
  role,
  userName,
  nav,
  children,
}: DashboardShellProps) {
  return (
    <div className="relative flex flex-1 flex-col">
      <BackgroundOrbs />

      <header className="relative z-10 border-b border-white/[0.06] backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <div className="flex items-center gap-3">
            <Sparkles className="h-4 w-4 text-muted-foreground" />
            <span className="font-heading text-2xl font-light tracking-tight text-gradient-neon">
              LUMEN
            </span>
            <span className="ml-3 hidden rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-0.5 text-[10px] uppercase tracking-[0.2em] text-muted-foreground sm:inline-block">
              {role}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium leading-tight">{userName}</p>
              <p className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {role}
              </p>
            </div>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs uppercase tracking-wider text-muted-foreground transition-all hover:border-white/20 hover:bg-white/[0.06] hover:text-foreground"
              >
                Déconnexion
              </button>
            </form>
          </div>
        </div>

        {nav ? (
          <div className="mx-auto max-w-7xl px-6">
            <div className="-mb-px">{nav}</div>
          </div>
        ) : null}
      </header>

      <main className="relative z-10 mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        {children}
      </main>
    </div>
  );
}
