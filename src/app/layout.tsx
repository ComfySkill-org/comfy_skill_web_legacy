import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/SiteHeader";

const geistSans = Geist({ subsets: ["latin"], variable: "--font-geist-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "ComfySkill — Skill-driven AI creation",
  description:
    "Text-to-image MVP for ComfySkill — sign in, generate from a prompt, and manage credits.",
  authors: [{ name: "Kelly Yang", url: "mailto:124ykl@gmail.com" }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} font-sans`}>
        <SiteHeader />
        <main>{children}</main>
      </body>
    </html>
  );
}
