import "./globals.css";
import { Inter } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { ClerkProvider } from "@clerk/nextjs";
import { Navbar } from "@/components/Navbar";
import type { ReactNode } from 'react';

const inter = Inter({ subsets: ["latin"] });

export const metadata = {
  title: "Ubumuntu AI",
  description: "AI-powered platform for RAG",
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
        </head>
        <body className={`${inter.className} h-full antialiased`}>
          <div className="grid min-h-screen grid-rows-[auto_1fr]">
            <Navbar />
            <main className="container mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-12">
              <div className="grid grid-cols-1 gap-8">
                <NuqsAdapter>{children}</NuqsAdapter>
              </div>
            </main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
