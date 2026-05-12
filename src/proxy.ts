import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Page-load guard:
 *   - On GET requests, refreshes the Supabase session and gates protected
 *     routes (redirect to /login if unauthenticated).
 *   - Other requests (POST server actions, RSC fetches, …) are NOT processed
 *     here — touching their response stream breaks the React Server
 *     Components protocol and surfaces as "Unexpected response from server"
 *     on the client. Server actions validate auth themselves via createClient.
 */
export async function proxy(request: NextRequest) {
  if (request.method !== "GET") {
    return NextResponse.next();
  }
  return updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
