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
        {/* 中身は文字列として渡す。子要素として書くと、CSS の書きぶりによっては
            端末側の組み直しで食い違い、ページ全体が描き直しになる。 */}
        <style dangerouslySetInnerHTML={{ __html: `
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

          /* ---- 記録の書き出し（印刷＝PDF保存）----
             画面では隠し、印刷のときだけ #bt-print を出す。
             PDFを組み立てる代わりにブラウザの印刷を使うので、日本語は端末の
             フォントで組まれ、追加のライブラリは0バイトで済む。 */
          #bt-print { display: none; }
          @media print {
            /* #bt-print は body の直下ではなく画面の木の奥にある。
               「body の子を隠す」書き方だと祖先ごと消えて、印刷が白紙になる
               （実測: 刷り上がりの高さが 0px になった）。
               display ではなく visibility なら、隠した中の一部だけを見せられる。 */
            body * { visibility: hidden !important; }
            #bt-print, #bt-print * { visibility: visible !important; }
            #bt-print {
              display: block !important;
              position: absolute; left: 0; top: 0; width: 100%;
            }
            @page { margin: 14mm 12mm; }
            html, body { background: #fff !important; }   /* body はインライン指定なので important が要る */
            #bt-print {
              color: #17150F; font-size: 10pt; line-height: 1.6;
              font-family: "Hiragino Sans", "Noto Sans JP", system-ui, sans-serif;
            }
            .bt-p-head { border-bottom: 2px solid #17150F; padding-bottom: 8pt; margin-bottom: 14pt; }
            .bt-p-brand { font-size: 8pt; letter-spacing: 0.2em; color: #8A857B; }
            .bt-p-h1 { font-size: 20pt; margin: 4pt 0 6pt; }
            .bt-p-meta { font-size: 8.5pt; color: #8A857B; }
            .bt-p-sum { display: flex; gap: 18pt; margin-bottom: 16pt; }
            .bt-p-big { font-size: 19pt; font-weight: 700; }
            .bt-p-unit { font-size: 8.5pt; color: #8A857B; margin-left: 3pt; }
            /* 見出しと中身が別のページに分かれないようにする */
            .bt-p-sec { margin-bottom: 14pt; break-inside: avoid; }
            .bt-p-h2 { font-size: 11pt; margin: 0 0 4pt; padding-bottom: 3pt; border-bottom: 1px solid #17150F; }
            .bt-p-note { font-size: 8pt; color: #8A857B; margin: 0 0 5pt; }
            .bt-p-table { width: 100%; border-collapse: collapse; }
            .bt-p-table td, .bt-p-table th { padding: 2.5pt 4pt; vertical-align: top; }
            .bt-p-name { width: 30%; }
            .bt-p-num { width: 8%; text-align: right; font-variant-numeric: tabular-nums; }
            .bt-p-bar { width: 45%; }
            .bt-p-pct { width: 10%; text-align: right; color: #8A857B; font-size: 8.5pt; }
            /* 一覧は長いので、行が途中で切れないようにしつつページをまたぐ */
            .bt-p-list { break-inside: auto; font-size: 9pt; }
            .bt-p-list thead { display: table-header-group; }   /* 各ページに見出しを繰り返す */
            .bt-p-list tr { break-inside: avoid; }
            .bt-p-list th { text-align: left; font-size: 8pt; color: #8A857B; border-bottom: 1px solid #E4E1D8; font-weight: 400; }
            .bt-p-list td { border-bottom: 1px solid #EFECE3; }
            .bt-p-date { white-space: nowrap; color: #8A857B; font-variant-numeric: tabular-nums; }
            .bt-p-star { white-space: nowrap; color: #A87B2E; }
            .bt-p-memo { font-size: 8pt; color: #8A857B; margin-top: 1pt; }
            .bt-p-foot { margin-top: 16pt; padding-top: 6pt; border-top: 1px solid #E4E1D8; font-size: 7.5pt; color: #8A857B; }
          }
` }} />
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
