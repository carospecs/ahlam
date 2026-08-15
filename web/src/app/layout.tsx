import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/ServiceWorkerRegister";

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
    <html lang="en" suppressHydrationWarning>
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
