import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Create route matchers for protected routes
const isProtectedRoute = createRouteMatcher([
  "/retrieval(.*)",
  "/agents(.*)",
  "/api/chat/(.*)",
  "/api/agents/(.*)",
  "/api/retrieval/(.*)"
]);

// Create route matchers for public routes
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)", "/"]);

export default clerkMiddleware(async (auth, req) => {
  // Add timeout headers for API routes to help with Netlify
  if (req.nextUrl.pathname.startsWith('/api/')) {
    const response = NextResponse.next()
    response.headers.set('X-Function-Timeout', '30')
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
  }

  // If it's a public route, allow access
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // For protected routes, require authentication
  if (isProtectedRoute(req)) {
    const { userId } = await auth()
    if (!userId) {
      return NextResponse.redirect(new URL('/sign-in', req.url))
    }
  }

  // Allow access to other routes (like API routes, static files, etc.)
  return NextResponse.next();
});

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public/).*)",
    "/",
    "/(api|trpc)(.*)",
    // Skip Next.js internals and all static files, unless found in search params
    '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
  ]
}; 