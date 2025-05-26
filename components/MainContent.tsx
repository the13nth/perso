"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

interface MainContentProps {
  children: ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const pathname = usePathname();
  const isHomePage = pathname === "/";

  if (isHomePage) {
    // Homepage gets full width without container constraints
    return <div className="w-full">{children}</div>;
  }

  // All other pages get the container styling
  return (
    <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
      <div className="grid grid-cols-1 gap-8">
        {children}
      </div>
    </div>
  );
} 