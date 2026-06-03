import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const sans = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CaroSpecs — Photo to parts listing, in seconds",
  description:
    "Photograph an auto part, let AI identify it and grade its condition, review in a tap, and post it anywhere you sell. Built for small salvage yards and parts shops.",
  openGraph: {
    title: "CaroSpecs — Photo to parts listing, in seconds",
    description:
      "AI part identification + condition grading for small auto salvage yards. Remove the expertise bottleneck.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={sans.variable}>
      <body>{children}</body>
    </html>
  );
}
