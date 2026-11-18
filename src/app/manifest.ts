import type { MetadataRoute } from "next";
import { APP_NAME } from "@/lib/config";

/** Web App Manifest:讓愛愛銀行可以加入主畫面,並以全螢幕(standalone)開啟 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: "給兩個人的愛心小銀行",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "zh-Hant",
    background_color: "#f3f9ff",
    theme_color: "#f3f9ff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
