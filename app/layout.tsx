import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Major Pick'em 2026",
  description: "Four majors. One champion.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
