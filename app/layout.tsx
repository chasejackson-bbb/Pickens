import type { Metadata } from "next";
import { Cormorant_Garamond, Lora } from "next/font/google";
import { NavBar } from "@/components/NavBar";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-heading",
  display: "swap",
});

const lora = Lora({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pickens Pick'em",
  description: "NFL against-the-spread draft pick'em for Blake, Jay, and Chase",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${lora.variable}`}>
      <body>
        <NavBar />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
