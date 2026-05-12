"use client";

import { useActionState } from "react";
import { motion } from "motion/react";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signIn, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState<LoginState, FormData>(
    signIn,
    null,
  );

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="next" value={next} />

      <FormField
        id="email"
        name="email"
        label="Identifiant"
        type="email"
        autoComplete="email"
        placeholder="prenom@lumen.studio"
        required
        delay={0.25}
      />
      <FormField
        id="password"
        name="password"
        label="Mot de passe"
        type="password"
        autoComplete="current-password"
        placeholder="••••••••••"
        required
        delay={0.32}
      />

      {state?.error ? (
        <motion.p
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          role="alert"
        >
          {state.error}
        </motion.p>
      ) : null}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.42, duration: 0.5 }}
      >
        <Button
          type="submit"
          size="lg"
          disabled={isPending}
          className="group bg-gradient-neon h-12 w-full rounded-xl text-base font-medium text-white shadow-[0_10px_40px_-10px_oklch(0.6_0.25_278/0.6)] transition-all hover:scale-[1.01] hover:shadow-[0_14px_50px_-10px_oklch(0.6_0.25_278/0.85)] disabled:opacity-70"
        >
          {isPending ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              <span>Connexion en cours…</span>
            </>
          ) : (
            <>
              <span>Connexion</span>
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>
      </motion.div>

      <motion.button
        type="button"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.55, duration: 0.5 }}
        className="block w-full text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
      >
        Mot de passe oublié ?
      </motion.button>
    </form>
  );
}

function FormField({
  id,
  name,
  label,
  type,
  autoComplete,
  placeholder,
  required,
  delay,
}: {
  id: string;
  name: string;
  label: string;
  type: string;
  autoComplete?: string;
  placeholder: string;
  required?: boolean;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      className="space-y-2"
    >
      <Label
        htmlFor={id}
        className="text-xs font-medium uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </Label>
      <Input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required={required}
        className="h-12 rounded-xl border-foreground/10 bg-foreground/[0.03] text-base text-foreground placeholder:text-muted-foreground/60 focus-visible:border-primary/60 focus-visible:bg-foreground/[0.05] focus-visible:ring-2 focus-visible:ring-primary/30"
      />
    </motion.div>
  );
}
