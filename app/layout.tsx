import type { Metadata } from "next";
import "./globals.css";
import SiteNav from "./_components/SiteNav";
import { site } from "@/content/site";

export const metadata: Metadata = {
  title: site.name,
  description: site.tagline,
};

/**
 * Root layout — wraps every route with the shared navigation and footer.
 * The navigation gives the landing ↔ catalog ↔ auth path (Requirement 1.2).
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <SiteNav />
        <main>{children}</main>
        <footer className="site-footer">
          <div className="container">
            © {new Date().getFullYear()} {site.name}
          </div>
        </footer>
      </body>
    </html>
  );
}
