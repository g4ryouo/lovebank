import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { APP_NAME } from "@/lib/config";
import { BottomNav } from "@/components/BottomNav";
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
  applicationName: APP_NAME,
  // iOS「加入主畫面」:以全螢幕開啟、主畫面上的名稱
  appleWebApp: { capable: true, title: APP_NAME, statusBarStyle: "default" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // 讓內容延伸到瀏覽器邊緣,搭配 safe-area 避開瀏海與底部橫條
  themeColor: "#f3f9ff",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="zh-Hant" className={`${huninn.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        {children}
        <BottomNav />
      </body>
    </html>
  );
}
