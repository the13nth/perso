import './polyfills';
import "./globals.css";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ClerkProvider } from "@clerk/nextjs";
import { Navbar } from "@/components/Navbar";
import { Toaster } from "@/components/ui/sonner";
import { MainContent } from "@/components/MainContent";
import type { ReactNode } from 'react';

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Ubumuntu AI",
  description: "AI Language Platform",
};

export default function RootLayout({
  children,
}: {
  children: ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="en" className="h-full">
        <head>
          <title>Ubumuntu AI</title>
          <link rel="shortcut icon" href="/images/favicon.ico" />
          <meta
            name="description"
            content="Starter template showing how to use LangChain in Next.js projects. See source code and deploy your own at https://github.com/langchain-ai/langchain-nextjs-template!"
          />
          <meta property="og:title" content="Ubumuntu AI" />
          <meta
            property="og:description"
            content="AI-powered platform for RAG"
          />
          <meta property="og:image" content="/images/og-image.png" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="Ubumuntu AI" />
          <meta
            name="twitter:description"
            content="AI-powered platform for RAG"
          />
          <meta name="twitter:image" content="/images/og-image.png" />
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <script src="https://cdn.plot.ly/plotly-2.27.1.min.js"></script>
        </head>
        <body className={`${inter.className} h-full antialiased`}>
          <div className="grid min-h-screen grid-rows-[auto_1fr]">
            <Navbar />
            <main className="w-full">
              <MainContent>
                <NuqsAdapter>{children}</NuqsAdapter>
              </MainContent>
            </main>
          </div>
          <Toaster />
        </body>
      </html>
    </ClerkProvider>
  );
}
