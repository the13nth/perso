import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

// Create route matchers for protected routes
const isProtectedRoute = createRouteMatcher([
  "/chat(.*)",
  "/retrieval(.*)", 
  "/agents(.*)",
  "/structured_output(.*)",
  "/streaming(.*)",
  "/visualize(.*)"
]);

// Create route matchers for public routes
const isPublicRoute = createRouteMatcher(["/sign-in(.*)", "/sign-up(.*)"]);

export default clerkMiddleware(async (auth, req) => {
  // If it's a public route, allow access
  if (isPublicRoute(req)) {
    return NextResponse.next();
  }

  // For protected routes, require authentication
  if (isProtectedRoute(req)) {
    await auth.protect();
  }
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
    "/(api|trpc)(.*)"
  ]
}; 