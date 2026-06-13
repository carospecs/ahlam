import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk, Space_Mono, Fraunces } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

const sans = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

// Brand display face — headlines, wordmark, names. Space Grotesk gives a distinct,
// technical wordmark (intentionally different from the typical geometric sans).
const display = Space_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

// Editorial serif for large marketing display headings (landing + guides only,
// applied via the .cs-display class so the app/dashboard keep the Poppins brand).
const serif = Fraunces({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  variable: "--font-serif",
  display: "swap",
});

// Brand detail face — labels, badges, contacts, numerals.
const mono = Space_Mono({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-mono",
  display: "swap",
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "https://ahlam.io";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Ahlam — Photo to parts listing, in seconds",
  description:
    "Photograph an auto part, let AI identify it and grade its condition, review in a tap, and post it anywhere you sell. Built for small salvage yards and parts shops.",
  openGraph: {
    title: "Ahlam — Photo to parts listing, in seconds",
    description:
      "AI part identification + condition grading for small auto salvage yards. Remove the expertise bottleneck.",
    type: "website",
  },
  manifest: "/manifest.webmanifest",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  appleWebApp: { capable: true, title: "Ahlam", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  themeColor: "#101A2C",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${sans.variable} ${display.variable} ${serif.variable} ${mono.variable}`} suppressHydrationWarning>
      <head>
        {/* Apply the saved theme before paint to avoid a flash of the wrong theme. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('cs-theme');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}`,
          }}
        />
      </head>
      <body>{children}<ServiceWorkerRegister /></body>
    </html>
  );
}
