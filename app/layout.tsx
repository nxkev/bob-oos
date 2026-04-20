import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bob's OOS",
  description: "Out-of-stock tracker",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
    { media: "(prefers-color-scheme: dark)", color: "#0e0e0d" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_92%,transparent)] backdrop-blur">
          <nav className="max-w-xl mx-auto flex items-center justify-between px-4 h-14">
            <Link
              href="/"
              className="flex items-center gap-2 font-semibold tracking-tight"
            >
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--ink)] text-[var(--bg)] text-sm">
                B
              </span>
              <span>Bob&apos;s OOS</span>
            </Link>
            <div className="seg">
              <Link
                href="/"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-[var(--muted)] hover:text-[var(--ink)]"
              >
                List
              </Link>
              <Link
                href="/submit"
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-[var(--surface)] text-[var(--ink)] shadow-sm"
              >
                Submit
              </Link>
            </div>
          </nav>
        </header>
        <main className="flex-1 max-w-xl w-full mx-auto px-4 pt-6 pb-24">
          {children}
        </main>
      </body>
    </html>
  );
}
