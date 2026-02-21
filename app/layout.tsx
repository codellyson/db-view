import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "DBView - Database Explorer",
    template: "%s | DBView",
  },
  description: "A clean, functional database explorer for PostgreSQL and MySQL. Browse tables, execute queries, and explore your database.",
  keywords: [
    "PostgreSQL",
    "MySQL",
    "database explorer",
    "database viewer",
    "SQL query",
    "database management",
    "database client",
    "database browser",
  ],
  authors: [{ name: "KreativeKorna Concepts", url: "https://kreativekorna.com" }],
  creator: "KreativeKorna Concepts",
  publisher: "KreativeKorna Concepts",
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
  metadataBase: new URL(appUrl),
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    title: "DBView - Database Explorer",
    description: "A clean, functional database explorer for PostgreSQL and MySQL. Browse tables, execute queries, and explore your database.",
    siteName: "DBView",
    images: [
      {
        url: "/logo.svg",
        width: 200,
        height: 200,
        alt: "DBView Logo",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "DBView - Database Explorer",
    description: "A clean, functional database explorer for PostgreSQL and MySQL.",
    images: ["/logo.svg"],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
  icons: {
    icon: "/logo.svg",
    shortcut: "/logo.svg",
    apple: "/logo.svg",
  },
  viewport: {
    width: "device-width",
    initialScale: 1,
    maximumScale: 1,
  },
  category: "database",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
