/**
 * Cryptographically strong random password generator.
 * Charset avoids visually ambiguous characters (0/O, 1/l/I) so passwords
 * are easy to copy/transmit manually without errors.
 */
const CHARSET =
  "ABCDEFGHJKLMNPQRSTUVWXYZ" + // no I, O
  "abcdefghijkmnopqrstuvwxyz" + // no l
  "23456789" + // no 0, 1
  "!@#$%&*-+?";

export function generatePassword(length = 16): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => CHARSET[b % CHARSET.length]!).join("");
}
