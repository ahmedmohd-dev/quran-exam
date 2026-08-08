import type { Metadata } from "next";
import "./globals.css";
import { PwaRegister } from "./pwa-register";

export const metadata: Metadata = {
  title: "مركز علي الحيدر | Qur'an Revision Examination",
  description: "Qur'an revision examination management system",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="am"><body suppressHydrationWarning><PwaRegister />{children}</body></html>;
}
