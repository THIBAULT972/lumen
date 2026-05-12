import { Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { BackgroundOrbs } from "@/components/background-orbs";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next ?? "/";

  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <BackgroundOrbs />

      <div className="relative w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-700">
        <Card className="glass-panel rounded-2xl border-0 bg-transparent shadow-none">
          <CardHeader className="space-y-4 px-7 pt-7">
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-muted-foreground">
              <Sparkles className="h-3 w-3" />
              <span>Studio</span>
            </div>

            <CardTitle className="font-heading text-5xl font-light leading-none">
              <span className="text-gradient-neon">LUMEN</span>
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              Connectez-vous à votre espace de production.
            </p>
          </CardHeader>

          <CardContent className="px-7 pb-7 pt-2">
            <LoginForm next={next} />
          </CardContent>
        </Card>

        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.28em] text-muted-foreground/60">
          Accès réservé · Équipe production
        </p>
      </div>
    </main>
  );
}
