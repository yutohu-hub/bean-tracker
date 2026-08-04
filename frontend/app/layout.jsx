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
  /* ホーム画面から起動したとき、画面の隅まで使う。
     これを入れないと iPhone のノッチ側と下端に黒い帯が残り、
     「ブラウザを全画面にしただけ」に見える。
     代わりに、中身が切り欠きに潜らないよう safe-area の余白を自分で足す。 */
  viewportFit: "cover",
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, background: "#FAFAF7" }}>
        {/* ホーム画面から起動したときだけ効く調整。ブラウザで見ているときは
            display-mode が browser なので、いずれも当たらない。 */}
        <style>{`
          @media (display-mode: standalone) {
            body {
              padding-top: env(safe-area-inset-top);
              padding-bottom: env(safe-area-inset-bottom);
              padding-left: env(safe-area-inset-left);
              padding-right: env(safe-area-inset-right);
            }
            /* 上に引っ張るとページ全体が跳ねてアプリらしくない。中身だけ動かす */
            html { overscroll-behavior-y: none; }
            /* 文字の長押しで選択メニューが出るのを、本文以外では止める */
            button, .bt-card { -webkit-touch-callout: none; -webkit-user-select: none; user-select: none; }
          }
          /* iOS はタップのたびに灰色の箱が出る。アプリとしては目障りなので消す */
          * { -webkit-tap-highlight-color: transparent; }
        `}</style>
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
