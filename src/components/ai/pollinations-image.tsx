"use client";

import { useState } from "react";
import { pollinationsUrl } from "@/lib/ai/pollinations";

/**
 * Petite vignette d'image générée par Pollinations.ai (gratuit, sans clé).
 * Skeleton pendant le chargement, fallback en cas d'erreur, ouvre en grand
 * dans un nouvel onglet au clic.
 */
export function PollinationsImage({
  prompt,
  aspect = "video",
  title,
}: {
  prompt: string;
  aspect?: "square" | "video";
  title?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const size = aspect === "square" ? { w: 768, h: 768 } : { w: 1024, h: 576 };
  const src = pollinationsUrl(prompt, {
    width: size.w,
    height: size.h,
  });
  const ratio = aspect === "square" ? "aspect-square" : "aspect-video";

  if (failed) {
    return (
      <div
        className={`${ratio} flex items-center justify-center rounded-md border border-dashed border-foreground/15 bg-foreground/[0.02] p-2 text-center text-[10px] text-muted-foreground`}
        title={title}
      >
        Génération indispo
      </div>
    );
  }

  return (
    <a
      href={src}
      target="_blank"
      rel="noopener"
      title={title}
      className={`${ratio} group relative block overflow-hidden rounded-md border border-foreground/10 bg-foreground/[0.04] transition-transform hover:scale-[1.02]`}
    >
      {!loaded ? (
        <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-foreground/[0.05] to-foreground/[0.02]" />
      ) : null}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={title ?? "Generated visual"}
        loading="lazy"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-opacity duration-500 ${loaded ? "opacity-100" : "opacity-0"}`}
      />
    </a>
  );
}
