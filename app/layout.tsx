import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
})

const SITE_NAME = "SEPANA"
const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
const OG_IMAGE = "/og.png"

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: `${SITE_NAME} | Digitale Baufinanzierung`,
    template: `%s | ${SITE_NAME}`,
  },
  description:
    "SEPANA ist die digitale Plattform für Baufinanzierung: vergleichen, Angebote auswählen, Unterlagen sicher hochladen und live finalisieren.",
  applicationName: SITE_NAME,
  alternates: {
    canonical: "./",
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: SITE_NAME,
    title: `${SITE_NAME} | Digitale Baufinanzierung`,
    description:
      "Baufinanzierung in einem klaren End-to-End-Flow: Erfassung, Vergleich, Auswahl, Upload und Live-Beratung.",
    images: [
      {
        url: OG_IMAGE,
        width: 1200,
        height: 630,
        alt: `${SITE_NAME} Open Graph`,
      },
    ],
    locale: "de_DE",
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE_NAME} | Digitale Baufinanzierung`,
    description:
      "Vergleichen, auswählen und abschließen: die SEPANA-Plattform für moderne Baufinanzierung.",
    images: [OG_IMAGE],
  },
  icons: {
    icon: [{ url: "/favicon.ico" }, { url: "/icon.png", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png" }],
  },
  manifest: "/site.webmanifest",
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0a2342",
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de">
      <body className={`${inter.variable} font-sans antialiased`}>{children}</body>
    </html>
  )
}
