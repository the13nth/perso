"use client";

import { useState, useEffect, useRef, useCallback, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { Brain, ChevronDown, Database, Settings, MessageSquare, Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPortal } from "react-dom";
import { useUser } from "@clerk/nextjs";
import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Sparkles, Lightbulb, Bot, Wrench, Users, Plug, BarChart3 } from "lucide-react";

interface DropdownItem {
  href: string;
  label: string;
  icon: ReactNode;
}

interface DropdownMenuProps {
  label: string;
  icon: ReactNode;
  items: DropdownItem[];
  id: string;
  activeDropdown: string | null;
  onDropdownChange: (id: string | null) => void;
}

const DropdownMenu = ({ label, items, icon, id, activeDropdown, onDropdownChange }: DropdownMenuProps) => {
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const pathname = usePathname()
  const isOpen = activeDropdown === id

  const updatePosition = useCallback(() => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 4,
        left: rect.left
      })
    }
  }, [])

  useEffect(() => {
    if (isOpen) {
      updatePosition()
      window.addEventListener('resize', updatePosition)
      window.addEventListener('scroll', updatePosition)
      
      return () => {
        window.removeEventListener('resize', updatePosition)
        window.removeEventListener('scroll', updatePosition)
      }
    }
  }, [isOpen, updatePosition])

  return (
    <div className="relative">
      <button
        ref={buttonRef}
        onClick={() => {
          updatePosition()
          onDropdownChange(isOpen ? null : id)
        }}
        className={cn(
          "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors hover:text-accent-foreground",
          isOpen && "text-accent-foreground"
        )}
      >
        {icon}
        {label}
        <ChevronDown className={cn("h-4 w-4 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div 
          className="fixed z-[9999] shadow-md rounded-md bg-popover p-1"
          style={{
            top: `${position.top}px`,
            left: `${position.left}px`,
            width: '12rem',
          }}
        >
          {items.map((item: DropdownItem) => (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-2 rounded-sm px-3 py-2 text-sm hover:bg-accent transition-colors",
                pathname === item.href && "bg-accent text-accent-foreground"
              )}
              onClick={() => onDropdownChange(null)}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </div>,
        document.body
      )}
    </div>
  )
}

interface ActiveLinkProps {
  href: string;
  children: ReactNode;
  icon?: ReactNode;
}

const ActiveLink = ({ href, children, icon }: ActiveLinkProps) => {
  const pathname = usePathname();
  
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm font-medium transition-colors hover:text-accent-foreground",
        pathname === href && "text-accent-foreground"
      )}
    >
      {icon}
      {children}
    </Link>
  );
};

const aiToolsItems: DropdownItem[] = [
  {
    href: "/agents",
    label: "Agents",
    icon: <Bot className="w-4 h-4" />,
  },
  {
    href: "/swarms",
    label: "Swarms",
    icon: <Users className="w-4 h-4" />,
  },
  {
    href: "/tools",
    label: "Tools",
    icon: <Wrench className="w-4 h-4" />,
  },
];

const dataItems: DropdownItem[] = [
  {
    href: "/embeddings",
    label: "Embeddings",
    icon: <Sparkles className="w-4 h-4" />,
  },
  {
    href: "/insights",
    label: "Insights",
    icon: <Lightbulb className="w-4 h-4" />,
  },
];

const systemItems: DropdownItem[] = [
  {
    href: "/integrations",
    label: "Integrations",
    icon: <Plug className="w-4 h-4" />,
  },
  {
    href: "/usage",
    label: "Usage",
    icon: <BarChart3 className="w-4 h-4" />,
  },
];

export function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const pathname = usePathname();
  const { isSignedIn } = useUser();

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!event.target || !(event.target instanceof Element)) return;
      
      // Check if click is on a dropdown trigger button
      const isDropdownButton = event.target.closest('button')?.querySelector('.lucide-chevron-down');
      if (isDropdownButton) return;

      // Close if click is outside dropdown
      if (!event.target.closest('.bg-popover')) {
        setActiveDropdown(null);
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Close dropdown when route changes
  useEffect(() => {
    setActiveDropdown(null);
  }, [pathname]);

  return (
    <nav className="sticky top-0 z-[999] w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container grid grid-cols-12 h-16 items-center">
        {/* Logo and mobile menu button */}
        <div className="col-span-3 flex items-center gap-2">
          <Link href="/" className="flex items-center gap-2">
            <Image src="/images/logo.png" width={32} height={32} alt="Logo" className="w-8 h-8" />
            <span className="font-semibold">Ubumuntu AI</span>
          </Link>
        </div>

        {/* Desktop Navigation */}
        <div className="col-span-9 hidden md:flex items-center justify-between">
          <div className="flex items-center gap-1">
            <ActiveLink href="/retrieval" icon={<MessageSquare className="w-4 h-4" />}>
              Chat
            </ActiveLink>

            <DropdownMenu
              id="ai-tools"
              label="AI Tools"
              icon={<Brain className="w-4 h-4" />}
              items={aiToolsItems}
              activeDropdown={activeDropdown}
              onDropdownChange={setActiveDropdown}
            />
            
            <DropdownMenu
              id="data"
              label="Data"
              icon={<Database className="w-4 h-4" />}
              items={dataItems}
              activeDropdown={activeDropdown}
              onDropdownChange={setActiveDropdown}
            />
            
            <DropdownMenu
              id="system"
              label="System"
              icon={<Settings className="w-4 h-4" />}
              items={systemItems}
              activeDropdown={activeDropdown}
              onDropdownChange={setActiveDropdown}
            />
          </div>

          {/* User section */}
          <div className="flex items-center gap-2">
            {isSignedIn ? (
              <UserButton afterSignOutUrl="/" />
            ) : (
              <>
                <SignInButton mode="modal">
                  <Button variant="ghost" size="sm">Sign in</Button>
                </SignInButton>
                <SignUpButton mode="modal">
                  <Button size="sm">Sign up</Button>
                </SignUpButton>
              </>
            )}
          </div>
        </div>

        {/* Mobile menu button */}
        <div className="col-span-9 flex md:hidden items-center justify-end">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="md:hidden"
          >
            {mobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <div 
        className={cn(
          "md:hidden grid grid-cols-1 border-t border-border/50 transition-all duration-300 ease-in-out z-[99]",
          mobileMenuOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        )}
      >
        <ActiveLink href="/retrieval" icon={<MessageSquare className="w-4 h-4" />}>
          Chat
        </ActiveLink>
        {aiToolsItems.map((item) => (
          <ActiveLink key={item.href} href={item.href} icon={item.icon}>
            {item.label}
          </ActiveLink>
        ))}
        {dataItems.map((item) => (
          <ActiveLink key={item.href} href={item.href} icon={item.icon}>
            {item.label}
          </ActiveLink>
        ))}
        {systemItems.map((item) => (
          <ActiveLink key={item.href} href={item.href} icon={item.icon}>
            {item.label}
          </ActiveLink>
        ))}
      </div>
    </nav>
  );
}
