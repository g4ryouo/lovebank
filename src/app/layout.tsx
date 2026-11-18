import type { Metadata } from "next";
import localFont from "next/font/local";
import { APP_NAME } from "@/lib/config";
import "./globals.css";

// jf open 粉圓(OFL 授權,見 ./fonts/OFL.txt)
const huninn = localFont({
  src: "./fonts/jf-openhuninn.woff2",
  variable: "--font-huninn",
  display: "swap",
});

export const metadata: Metadata = {
  title: APP_NAME,
  description: "給兩個人的愛心點數小銀行",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={`${huninn.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
