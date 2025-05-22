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
      <html lang="en">
        <head>
          <title>Ubumuntu AI</title>
          <link rel="shortcut icon" href="/images/favicon.ico" />
          <meta
            name="description"
            content="Starter template showing how to use LangChain in Next.js projects. See source code and deploy your own at https://github.com/langchain-ai/langchain-nextjs-template!"
          />
          <meta property="og:title" content="LangChain + Next.js Template" />
          <meta
            property="og:description"
            content="Starter template showing how to use LangChain in Next.js projects. See source code and deploy your own at https://github.com/langchain-ai/langchain-nextjs-template!"
          />
          <meta property="og:image" content="/images/og-image.png" />
          <meta name="twitter:card" content="summary_large_image" />
          <meta name="twitter:title" content="LangChain + Next.js Template" />
          <meta
            name="twitter:description"
            content="Starter template showing how to use LangChain in Next.js projects. See source code and deploy your own at https://github.com/langchain-ai/langchain-nextjs-template!"
          />
          <meta name="twitter:image" content="/images/og-image.png" />
        </head>
        <body className={inter.className}>
          <div className="relative flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 pt-16 md:pt-0">
              <NuqsAdapter>{children}</NuqsAdapter>
            </main>
          </div>
        </body>
      </html>
    </ClerkProvider>
  );
}
