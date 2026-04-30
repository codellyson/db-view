import type { Metadata, Viewport } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import { Providers } from "./providers";

// Geist + Geist Mono via the `geist` package (Next 14.2 doesn't expose them
// from `next/font/google`). Each exposes a CSS variable that Tailwind picks
// up via fontFamily.sans / fontFamily.mono in tailwind.config.ts.

const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

export const metadata: Metadata = {
  title: {
    default: "DBView — Pocket DB Explorer",
    template: "%s | DBView",
  },
  description: "Your database in your pocket. Browse tables, run queries, and inspect schemas on any device. Connects directly — nothing leaves your browser.",
  keywords: [
    "PostgreSQL",
    "MySQL",
    "pocket database explorer",
    "mobile database client",
    "SQL query tool",
    "database browser",
    "mobile-first database",
    "local database viewer",
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
    title: "DBView — Pocket DB Explorer",
    description: "Your database in your pocket. Browse, query, and explore PostgreSQL and MySQL from any device.",
    siteName: "DBView",
    // OG / Twitter images are produced by `app/opengraph-image.tsx` (a
    // 1200×630 PNG generated at build/request time). Next picks them up
    // automatically; no `images` field needed here.
  },
  twitter: {
    card: "summary_large_image",
    title: "DBView — Pocket DB Explorer",
    description: "Your database in your pocket. Mobile-first explorer for PostgreSQL and MySQL.",
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
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "DBView",
  },
  icons: {
    icon: [
      { url: "/icons/icon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192x192.png", sizes: "192x192", type: "image/png" },
    ],
    shortcut: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  other: {
    "mobile-web-app-capable": "yes",
  },
  category: "database",
};

// Next 14+ requires `viewport` to be its own export (was deprecated inside
// `metadata`). `themeColor` lives here too so we can match the active dark
// theme; CSS color-scheme handles the rest.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0d1117" },
  ],
};

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "DBView",
  description:
    "Pocket DB Explorer — browse tables, run queries, and inspect schemas on any device. Connects directly; nothing leaves your browser.",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web Browser",
  offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
  url: appUrl,
  publisher: {
    "@type": "Organization",
    name: "KreativeKorna Concepts",
    url: "https://kreativekorna.com",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
