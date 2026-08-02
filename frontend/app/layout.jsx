import { PWARegister } from "@/components/PWARegister";

const base = process.env.NEXT_PUBLIC_BASE_PATH || "";
// metadataBase はオリジンだけ。以降のパスは base 付きの相対で書く
// （両方に base を入れると /bean-tracker/bean-tracker/... になる）
const ORIGIN = "https://yutohu-hub.github.io";
const SITE = `${base || ""}/`;

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
  // SNSやメッセージアプリに貼ったときの見え方。これが無いと、URLだけが
  // 素のまま出てタイトルも画像も付かない（送客が目的なので、貼られる形は重要）。
  metadataBase: new URL(ORIGIN),
  // 共有リンクは ?b=... のようにクエリが付く。中身は同じ1枚なので、
  // 検索側には正規のURLを1つだけ示す（同じ内容が別URLとして重複しないように）
  alternates: { canonical: SITE },
  openGraph: {
    type: "website",
    siteName: "BEAN TRACKER",
    locale: "ja_JP",
    url: SITE,
    title: "BEAN TRACKER — Find any bean, anywhere.",
    description:
      "世界中のロースターの在庫を毎時追いかけて、いま買える豆だけを並べています。",
    images: [{ url: `${base}/icon-512.png`, width: 512, height: 512, alt: "BEAN TRACKER" }],
  },
  twitter: {
    card: "summary",
    title: "BEAN TRACKER — Find any bean, anywhere.",
    description:
      "世界中のロースターの在庫を毎時追いかけて、いま買える豆だけを並べています。",
    images: [`${base}/icon-512.png`],
  },
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
