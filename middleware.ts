import { NextRequest, NextResponse } from "next/server";
import {
  buildSecurityHeaders,
  createSessionToken,
  getSessionCookieOptions,
  SESSION_COOKIE_NAME,
  verifySessionToken,
} from "@/lib/security";

export async function middleware(req: NextRequest) {
  const response = NextResponse.next();

  const headers = buildSecurityHeaders();
  for (const [key, value] of Object.entries(headers)) {
    response.headers.set(key, value);
  }

  const existingToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
  const session = await verifySessionToken(existingToken);

  if (!session) {
    const token = await createSessionToken();
    response.cookies.set(SESSION_COOKIE_NAME, token, getSessionCookieOptions());
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
