import type { Metadata } from "next";
import { Source_Serif_4 } from "next/font/google";
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
        {children}
      </body>
    </html>
  );
}
