import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Neural Search Engine",
  description: "Industry-grade RAG — hybrid retrieval, reranking, streaming",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="bg-bg-base text-text-primary font-sans min-h-screen">
        {children}
      </body>
    </html>
  );
}