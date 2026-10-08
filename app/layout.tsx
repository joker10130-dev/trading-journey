import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Trading Journal — Track your edge",
  description: "A calm, clear home for your trading performance and journal.",
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
