import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hokie Concierge",
  description: "Ask one question. A main agent coordinates a Dining Scout and a Transit Guide for you.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
