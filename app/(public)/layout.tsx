import Link from "next/link";
import { SITE_NAME } from "@/lib/site";

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
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
    </>
  );
}
