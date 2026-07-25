import { PWARegister } from "@/components/PWARegister";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";

export const metadata = {
  title: "BEAN TRACKER — Find any bean, anywhere.",
  description:
    "世界中のロースターの豆をパッケージ図鑑として集めるトラッカー。売らない、評価しない、送客に徹する。",
  manifest: `${base}/manifest.webmanifest`,
  icons: {
    icon: [
      { url: `${base}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${base}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
    apple: `${base}/apple-touch-icon.png`,
  },
  appleWebApp: { capable: true, statusBarStyle: "default", title: "BEAN TRACKER" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#17150F",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, background: "#FAFAF7" }}>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
