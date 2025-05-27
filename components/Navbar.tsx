"use client";

import { cn } from "@/utils/cn";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import Link from "next/link";
import { UserButton, SignedIn, SignedOut, useAuth } from "@clerk/nextjs";
import { Menu, X, Database, Sparkles, Github, Lightbulb, Bot, Loader2 } from "lucide-react";

export const ActiveLink = (props: { href: string; children: ReactNode; icon?: ReactNode }) => {
  const pathname = usePathname();
  const isActive = pathname === props.href;
  
  return (
    <Link
      href={props.href}
      className={cn(
        "transition-colors hover:text-foreground/80 text-foreground/60 flex items-center gap-2 px-3 py-2 rounded-md",
        isActive && "text-foreground font-semibold hover:text-foreground bg-accent/50"
      )}
    >
      {props.icon}
      {props.children}
    </Link>
  );
};

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { isLoaded, isSignedIn } = useAuth();
  const toggleMobileMenu = () => setMobileMenuOpen(!mobileMenuOpen);
  
  const navLinks = [
    //{ href: "/chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
    { href: "/retrieval", label: "Chat", icon: <Database className="h-4 w-4" /> },
    // { href: "/agents", label: "Agents", icon: <Bot className="h-4 w-4" /> },
    //{ href: "/structured_output", label: "Structured Output", icon: <Layout className="h-4 w-4" /> },
    //{ href: "/streaming", label: "Streaming", icon: <Radio className="h-4 w-4" /> },
    { href: "/embeddings", label: "Embeddings", icon: <Sparkles className="h-4 w-4" /> },
    { href: "/insights", label: "Insights", icon: <Lightbulb className="h-4 w-4" /> },
  ];

  // Get the correct sign out URL based on environment
  const getSignOutUrl = () => {
    // Use the environment variable if set (for production)
    if (process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL) {
      return process.env.NEXT_PUBLIC_CLERK_AFTER_SIGN_OUT_URL;
    }
    
    // Fallback to window.location.origin for development or if env var is not set
    if (typeof window !== 'undefined') {
      return `${window.location.origin}/`;
    }
    
    // Final fallback
    return '/';
  };

  // Show loading state while auth is being checked
  if (!isLoaded) {
    return (
      <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container grid grid-cols-12 h-16 items-center">
          <div className="col-span-8 sm:col-span-4 lg:col-span-3 flex items-center gap-2">
            <div className="flex items-center space-x-2 px-3 py-2">
              <div className="relative w-8 h-8">
                <svg viewBox="0 0 24 24" className="w-full h-full fill-current opacity-50">
                  <title>Ubumuntu AI Logo</title>
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
                </svg>
              </div>
              <span className="font-bold text-lg opacity-50">Ubumuntu AI</span>
            </div>
          </div>
          <div className="col-span-4 sm:col-span-4 lg:col-span-2 flex items-center justify-end">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container grid grid-cols-12 h-16 items-center">
        {/* Logo and mobile menu button */}
        <div className="col-span-8 sm:col-span-4 lg:col-span-3 flex items-center gap-2">
          <Link 
            href="/" 
            className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors"
            onClick={() => mobileMenuOpen && setMobileMenuOpen(false)}
          >
            <div className="relative w-8 h-8">
              <svg viewBox="0 0 24 24" className="w-full h-full fill-current">
                <title>Ubumuntu AI Logo</title>
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" className="animate-pulse" />
              </svg>
            </div>
            <span className="font-bold text-lg">Ubumuntu AI</span>
          </Link>
          <button
            type="button"
            className="ml-auto md:hidden p-2 hover:bg-accent/50 rounded-md"
            onClick={toggleMobileMenu}
            aria-expanded={mobileMenuOpen}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>
        
        {/* Desktop navigation links - hidden on mobile */}
        <div className="hidden md:flex md:col-span-6 lg:col-span-7 items-center justify-center">
          <div className="flex items-center gap-1 overflow-x-auto py-2 px-4 scrollbar-hide">
            {navLinks.map((link) => (
              <ActiveLink key={link.href} href={link.href} icon={link.icon}>
                {link.label}
              </ActiveLink>
            ))}
            
          </div>
        </div>
        
        {/* User account section */}
        <div className="col-span-4 sm:col-span-4 lg:col-span-2 flex items-center justify-end gap-2">
          <SignedIn>
            <UserButton 
              afterSignOutUrl={getSignOutUrl()}
              appearance={{
                elements: {
                  avatarBox: "w-8 h-8",
                }
              }}
            />
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              Sign In
            </Link>
          </SignedOut>
        </div>
      </div>
      
      {/* Mobile menu - shown when toggled */}
      <div 
        className={cn(
          "md:hidden grid grid-cols-1 border-t border-border/50 transition-all duration-300 ease-in-out",
          mobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        )}
      >
        <div className="bg-background py-3 px-4 grid grid-cols-1 gap-2">
          {navLinks.map((link) => (
            <div key={link.href} onClick={toggleMobileMenu}>
              <ActiveLink href={link.href} icon={link.icon}>
                {link.label}
              </ActiveLink>
            </div>
          ))}
         
        </div>
      </div>
    </nav>
  );
}
