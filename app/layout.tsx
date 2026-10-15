import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
import Link from "next/link";
import { SITE_NAME } from "@/lib/site";
import "./globals.css";

const serif = Source_Serif_4({ subsets: ["latin"], variable: "--font-serif", display: "swap" });

export const metadata: Metadata = {
  title: { default: `${SITE_NAME} — free review of your funeral, cemetery or preneed contract`, template: `%s — ${SITE_NAME}` },
  description:
    "Upload your funeral, cemetery or preneed contract. A contract reviewer goes through it line by line and tells you what looks fair, what doesn't, and what to ask about. It costs nothing.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={serif.variable}>
      <body>
        <header className="site-header">
          <div className="wrap">
            <Link href="/" className="brand">{SITE_NAME}</Link>
            <Link href="/submit" className="button secondary">Start a free review</Link>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            <p>Reviews are free and informational. They are not legal or financial advice.</p>
            <Link href="/privacy">Privacy and what we keep</Link>
          </div>
        </footer>
      </body>
    </html>
  );
}
