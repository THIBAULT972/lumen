/**
 * Pollinations.ai — free text-to-image API, no key required.
 *
 * Pattern : just point an <img src=...> at this URL ; Pollinations renders
 * the image on first request and caches it on their CDN. ~3-8 s for first
 * render, near-instant on subsequent requests with the same seed.
 *
 * Doc : https://pollinations.ai/
 */

const BASE_URL = "https://image.pollinations.ai/prompt";

export type PollinationsOpts = {
  width?: number;
  height?: number;
  seed?: number;
  /** flux (default), turbo (faster), or any model Pollinations supports. */
  model?: "flux" | "turbo";
  /** Removes the Pollinations watermark. Default true. */
  nologo?: boolean;
  /** Disable the safety filter ; we keep it ON by default. */
  unsafe?: boolean;
};

/**
 * Hash a string to a stable 32-bit signed int — used as a default seed so
 * the same prompt always returns the same image (no flicker on re-render).
 */
function hashSeed(prompt: string): number {
  let h = 2166136261;
  for (let i = 0; i < prompt.length; i++) {
    h ^= prompt.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Coerce to positive 31-bit int (Pollinations expects an int).
  return Math.abs(h) & 0x7fffffff;
}

export function pollinationsUrl(
  prompt: string,
  opts: PollinationsOpts = {},
): string {
  const {
    width = 1024,
    height = 576,
    seed,
    model = "flux",
    nologo = true,
    unsafe = false,
  } = opts;

  const params = new URLSearchParams({
    width: String(width),
    height: String(height),
    model,
    nologo: String(nologo),
    seed: String(seed ?? hashSeed(prompt)),
  });
  if (unsafe) params.set("safe", "false");

  // Pollinations accepts the prompt as a path segment ; URI-encode strictly.
  return `${BASE_URL}/${encodeURIComponent(prompt)}?${params.toString()}`;
}
