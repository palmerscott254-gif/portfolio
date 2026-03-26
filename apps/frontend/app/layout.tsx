import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Newton Digital OS",
  description: "Persistent real-time portfolio operating system"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
