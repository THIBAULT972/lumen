"use client";

import { motion } from "motion/react";
import { ArrowRight, Sparkles } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <main className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-12">
      <BackgroundOrbs />

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
        className="relative w-full max-w-md"
      >
        <Card className="glass-panel rounded-2xl border-0 bg-transparent shadow-none">
          <CardHeader className="space-y-4 px-7 pt-7">
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15, duration: 0.5 }}
              className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em] text-muted-foreground"
            >
              <Sparkles className="h-3 w-3" />
              <span>Studio</span>
            </motion.div>

            <CardTitle className="font-heading text-5xl font-light leading-none">
              <span className="text-gradient-neon">LUMEN</span>
            </CardTitle>

            <p className="text-sm text-muted-foreground">
              Connectez-vous à votre espace de production.
            </p>
          </CardHeader>

          <CardContent className="space-y-5 px-7 pb-7 pt-2">
            <FormField
              id="email"
              label="Identifiant"
              type="email"
              placeholder="prenom@lumen.studio"
              delay={0.25}
            />
            <FormField
              id="password"
              label="Mot de passe"
              type="password"
              placeholder="••••••••••"
              delay={0.32}
            />

            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.42, duration: 0.5 }}
            >
              <Button
                size="lg"
                className="group bg-gradient-neon h-12 w-full rounded-xl text-base font-medium text-white shadow-[0_10px_40px_-10px_oklch(0.6_0.25_278/0.6)] transition-all hover:scale-[1.01] hover:shadow-[0_14px_50px_-10px_oklch(0.6_0.25_278/0.85)]"
              >
                <span>Connexion</span>
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
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
          </CardContent>
        </Card>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7, duration: 0.5 }}
          className="mt-6 text-center text-[11px] uppercase tracking-[0.28em] text-muted-foreground/60"
        >
          Accès réservé · Équipe production
        </motion.p>
      </motion.div>
    </main>
  );
}

function FormField({
  id,
  label,
  type,
  placeholder,
  delay,
}: {
  id: string;
  label: string;
  type: string;
  placeholder: string;
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
        type={type}
        placeholder={placeholder}
        className="h-12 rounded-xl border-white/10 bg-white/[0.03] text-base text-foreground placeholder:text-muted-foreground/40 focus-visible:border-primary/60 focus-visible:bg-white/[0.05] focus-visible:ring-2 focus-visible:ring-primary/30"
      />
    </motion.div>
  );
}

function BackgroundOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5 }}
        className="absolute left-1/2 top-1/3 h-[42rem] w-[42rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[oklch(0.55_0.25_258)] opacity-[0.28] blur-[180px]"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.2 }}
        className="absolute right-1/4 bottom-1/4 h-[34rem] w-[34rem] translate-x-1/3 translate-y-1/3 rounded-full bg-[oklch(0.55_0.28_310)] opacity-[0.22] blur-[180px]"
      />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.5, delay: 0.4 }}
        className="absolute left-1/4 top-2/3 h-[28rem] w-[28rem] -translate-x-1/3 rounded-full bg-[oklch(0.6_0.2_200)] opacity-[0.14] blur-[160px]"
      />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_0%,oklch(0_0_0/0.6)_70%,oklch(0_0_0)_100%)]" />
    </div>
  );
}
