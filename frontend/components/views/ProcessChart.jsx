"use client";
import { INK, GRAY } from "../lib/theme";
import { RATES_TO_JPY, toJPY, perGrams } from "../lib/currency";
import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { PROC, processKey } from "../lib/palette";

// 図鑑カードと同じ精製カラーで、いま買える豆を精製方法ごとに集計する棒グラフ。
const ORDER = ["washed", "natural", "honey", "anatural", "awashed", "other"];
const JP = { washed: "水洗", natural: "ナチュラル", honey: "ハニー", anatural: "嫌気性ナチュラル", awashed: "嫌気性ウォッシュト", other: "その他" };

export function ProcessChart({ cur = "JPY", onProcess }) {
  const beans = BEANS.filter((b) => b.status === "now" && ROASTERS[b.r] && ROASTERS[b.r].url);
  const per100 = (b) => (toJPY(b) / perGrams(b)) * 100;
  const fmt = (jpy) => cur === "JPY" ? `¥${Math.round(jpy).toLocaleString()}` : `$${(jpy / RATES_TO_JPY.USD).toFixed(0)}`;

  // 精製キーごとに件数・平均100g価格を集計
  const g = {};
  for (const b of beans) {
    const k = processKey(b.process);
    (g[k] = g[k] || { n: 0, sum: 0 }).n++;
    g[k].sum += per100(b);
  }
  const rows = ORDER.filter((k) => g[k]).map((k) => ({ k, ...PROC[k], n: g[k].n, avg: g[k].sum / g[k].n, jp: JP[k] }));
  const total = beans.length;
  const maxN = rows.reduce((m, r) => Math.max(m, r.n), 1);

  return (
    <div style={{ marginTop: 30, borderTop: `2px solid ${INK}`, paddingTop: 16 }}>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>BY PROCESS</div>
      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 4 }}>精製方法ごとの内訳</div>
      <div style={{ fontSize: 11, color: GRAY, marginTop: 3, lineHeight: 1.7 }}>
        いま買える <span style={{ fontFamily: "ui-monospace, monospace", fontWeight: 700 }}>{total}</span> 銘柄を精製方法で分類。色は図鑑カードと共通です。棒をタップで各精製のページへ。
      </div>

      <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
        {rows.map((r) => {
          const share = (r.n / total) * 100;
          return (
            <button key={r.k} onClick={() => onProcess && onProcess(r.k)}
              style={{ display: "block", width: "100%", textAlign: "left", background: "none", border: "none", padding: 0, cursor: "pointer" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 7, minWidth: 0 }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: r.bg, flexShrink: 0 }} />
                  <span style={{ fontSize: 12.5, fontWeight: 700, color: INK, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
                  <span style={{ fontSize: 10.5, color: GRAY, flexShrink: 0 }}>{r.jp}</span>
                </span>
                <span style={{ display: "flex", alignItems: "baseline", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11.5, color: INK }}>{r.n}<span style={{ fontSize: 9.5, color: GRAY }}>銘柄 / {share.toFixed(0)}%</span></span>
                  <span style={{ fontSize: 12, color: GRAY }}>›</span>
                </span>
              </div>
              <div style={{ height: 16, background: "#F0EDE4", borderRadius: 4, marginTop: 5, overflow: "hidden" }}>
                <div className="bt-bar" style={{ height: "100%", borderRadius: 4, width: `${(r.n / maxN) * 100}%`, background: r.bg }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 3 }}>
                <span style={{ fontSize: 9.5, color: GRAY }}>平均 {fmt(r.avg)} / 100g</span>
                <span style={{ fontSize: 9.5, color: GRAY }}>ページを開く ›</span>
              </div>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 9.5, color: GRAY, marginTop: 12, lineHeight: 1.6 }}>
        ※ 集計対象は「いま買える（NOW）」の豆のみ。価格は100gあたりの円換算で平均しています。
      </div>
    </div>
  );
}
