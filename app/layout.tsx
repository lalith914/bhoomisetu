
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: {
    default: "BHOOMISETU — Land Intelligence",
    template: "%s | BHOOMISETU",
  },
  description:
    "Explore land with geospatial intelligence, satellite imagery and evidence-backed insights.",
  applicationName: "BHOOMISETU",
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  openGraph: {
    title: "BHOOMISETU — Land Intelligence",
    description:
      "Discover land through satellite imagery and geospatial intelligence.",
    type: "website",
    siteName: "BHOOMISETU",
  },
  twitter: {
    card: "summary_large_image",
    title: "BHOOMISETU — Land Intelligence",
    description:
      "Explore land with geospatial intelligence and satellite insights.",
    images: ["/images/bhoomisetu-cover.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
