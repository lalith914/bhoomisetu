import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "BHOOMISETU — Land Intelligence",
  description: "An immersive geospatial land intelligence platform.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
