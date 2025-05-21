"use client";

import { cn } from "@/utils/cn";
import { usePathname } from "next/navigation";
import { type ReactNode, useState } from "react";
import Link from "next/link";
import { UserButton, SignedIn, SignedOut } from "@clerk/nextjs";
import { Menu, MessageSquare, Database, Bot, Layout, Radio, Sparkles, Github } from "lucide-react";

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
  
  const navLinks = [
    { href: "/chat", label: "Chat", icon: <MessageSquare className="h-4 w-4" /> },
    { href: "/retrieval", label: "Retrieval", icon: <Database className="h-4 w-4" /> },
    { href: "/agents", label: "Agents", icon: <Bot className="h-4 w-4" /> },
    { href: "/structured_output", label: "Structured Output", icon: <Layout className="h-4 w-4" /> },
    { href: "/streaming", label: "Streaming", icon: <Radio className="h-4 w-4" /> },
    { href: "/embeddings", label: "Embeddings", icon: <Sparkles className="h-4 w-4" /> },
  ];

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center space-x-2 px-3 py-2 rounded-md hover:bg-accent/50 transition-colors">
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
            className="md:hidden p-2 hover:bg-accent/50 rounded-md"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            <Menu className="h-6 w-6" />
          </button>
        </div>
        
        <div className={cn(
          "absolute top-16 left-0 w-full bg-background md:static md:w-auto transition-all duration-300 ease-in-out",
          mobileMenuOpen ? "block" : "hidden md:block"
        )}>
          <div className="container md:container-none flex flex-col md:flex-row items-start md:items-center gap-1 py-4 md:py-0">
            {navLinks.map((link) => (
              <ActiveLink key={link.href} href={link.href} icon={link.icon}>
                {link.label}
              </ActiveLink>
            ))}
            <Link
              href="https://github.com/yourusername/ubumuntu-ai"
              className="flex items-center gap-2 px-3 py-2 rounded-md transition-colors hover:text-foreground/80 text-foreground/60 hover:bg-accent/50"
              target="_blank"
            >
              <Github className="h-4 w-4" />
              GitHub
            </Link>
          </div>
        </div>
        
        <div className="hidden md:flex items-center gap-4">
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
          <SignedOut>
            <Link
              href="/sign-in"
              className="px-4 py-2 rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Sign In
            </Link>
          </SignedOut>
        </div>
      </div>
    </nav>
  );
}
