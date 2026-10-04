import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, readSession } from "./lib/session";

export async function middleware(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  const role = await readSession(token);
  const path = request.nextUrl.pathname;
  if (path.startsWith("/admin/login")) {
    if (role === "admin") return NextResponse.redirect(new URL("/admin", request.url));
    return NextResponse.next();
  }
  if (path.startsWith("/login")) {
    if (role) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (!role) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico).*)"],
};
