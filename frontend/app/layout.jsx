export const metadata = {
  title: "BEAN TRACKER — 世界中のコーヒー豆に辿り着くためのインフラ",
  description:
    "世界中のロースターの豆をパッケージ図鑑として集めるトラッカー。売らない、評価しない、送客に徹する。",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="ja">
      <body style={{ margin: 0, background: "#FAFAF7" }}>{children}</body>
    </html>
  );
}
