"use client";

import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export default function IntegrationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isRoot = pathname === "/integrations";

  return (
    <div className={cn(
      "min-h-screen w-full",
      !isRoot && "max-w-4xl mx-auto" // Constrain width on individual integration pages
    )}>
      {children}
    </div>
  );
} 