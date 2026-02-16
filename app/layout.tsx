import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CodeCocoon — Unwrap Your AI-Generated Code",
  description:
    "You built it with AI. Now understand what's inside. Connect your GitHub repo, get your codebase analyzed, and emerge as a real developer.",
  keywords: ["codecocoon", "vibe coding", "learn to code", "AI coding", "code education", "GitHub"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${spaceGrotesk.variable} ${dmSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
