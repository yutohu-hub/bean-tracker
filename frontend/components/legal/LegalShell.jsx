import Link from "next/link";
import { FS, INK, PAPER, GRAY, LINE } from "../lib/theme";

// 法務ページ共通の枠（サーバーコンポーネント・静的出力）
export function LegalShell({ title, updated, children }) {
  const pages = [
    ["/legal/tokushoho/", "特定商取引法に基づく表記"],
    ["/legal/terms/", "利用規約"],
    ["/legal/privacy/", "プライバシーポリシー"],
  ];
  return (
    <div style={{ minHeight: "100vh", background: PAPER, color: INK, fontFamily: `"Hiragino Kaku Gothic ProN", "Hiragino Sans", "Noto Sans JP", sans-serif` }}>
      <header style={{ borderBottom: `2px solid ${INK}` }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "14px 20px" }}>
          <Link href="/" style={{ fontSize: FS.body, color: GRAY, textDecoration: "none" }}>← BEAN TRACKER にもどる</Link>
          <div style={{ fontWeight: 800, fontSize: FS.head, letterSpacing: "0.04em", marginTop: 8 }}>{title}</div>
          {updated && <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY, marginTop: 4 }}>最終更新: {updated}</div>}
        </div>
      </header>
      <main style={{ maxWidth: 720, margin: "0 auto", padding: "22px 20px 70px", fontSize: FS.body, lineHeight: 1.9 }}>
        {children}
        <nav style={{ marginTop: 40, borderTop: `1px solid ${LINE}`, paddingTop: 16, display: "flex", flexWrap: "wrap", gap: 16 }}>
          {pages.filter(([, l]) => l !== title).map(([href, label]) => (
            <Link key={href} href={href} style={{ fontSize: FS.body, color: GRAY }}>{label}</Link>
          ))}
        </nav>
      </main>
    </div>
  );
}

// 公開前に実データへ置き換える箇所を強調表示するプレースホルダ
export function Fill({ children }) {
  return <mark style={{ background: "#FFF1B8", color: "#7A5B00", padding: "0 4px", borderRadius: 3, fontWeight: 700 }}>【要記入：{children}】</mark>;
}

export const H = ({ children }) => (
  <h2 style={{ fontSize: FS.lead, fontWeight: 800, margin: "26px 0 8px", paddingBottom: 4, borderBottom: `1px solid ${LINE}` }}>{children}</h2>
);
