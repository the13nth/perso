"use client";

import { SignIn, useClerk } from "@clerk/nextjs";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

export default function SignInPage() {
  const [isMounted, setIsMounted] = useState(false);
  const { loaded } = useClerk();

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      {(!isMounted || !loaded) && (
        <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}
      <div className="w-full max-w-md p-4 space-y-4">
        <SignIn 
          appearance={{
            elements: {
              rootBox: "w-full",
              card: "bg-background border border-border shadow-lg",
              headerTitle: "text-foreground",
              headerSubtitle: "text-muted-foreground",
              socialButtonsBlockButton: "bg-background border border-border text-foreground hover:bg-accent",
              formButtonPrimary: "bg-primary text-primary-foreground hover:bg-primary/90",
              footerActionLink: "text-primary hover:text-primary/90",
              formFieldLabel: "text-foreground",
              formFieldInput: "bg-background border border-input text-foreground",
            },
          }}
          afterSignInUrl="/retrieval"
          signUpUrl="/sign-up"
        />
      </div>
    </div>
  );
} 