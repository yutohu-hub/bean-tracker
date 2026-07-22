"use client";
import { INK, PAPER, GRAY, LINE, GREEN, AMBER } from "../lib/theme";
import { RATES_TO_JPY, toJPY, perGrams } from "../lib/currency";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";
import { Package } from "../ui/Package";

function VarietySection({ vt, title, sub, onOpen, cur }) {
  const all = BEANS.filter((b) => b.vt === vt);
  const live = all.filter((b) => b.status === "now");
  const soldNow = all.filter((b) => b.status === "sold");
  const arc = all.filter((b) => b.status === "archive");
  const per100 = (b) => (toJPY(b) / perGrams(b)) * 100;
  const fmt100 = (b) => cur === "JPY" ? `¥${Math.round(per100(b)).toLocaleString()}` : `$${(per100(b) / RATES_TO_JPY.USD).toFixed(0)}`;
  const ladder = [...live, ...soldNow].sort((a, b) => per100(a) - per100(b));
  const maxP = Math.max(...ladder.map(per100));
  const years = [...new Set(arc.map((b) => b.year))].sort((a, b) => b - a);

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.08em" }}>{title}</span>
        <span style={{ fontSize: 10, color: GRAY }}>{sub}</span>
      </div>

      {/* ライブカウンター */}
      <div style={{ borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${LINE}`, padding: "12px 0", marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="bt-live" style={{ width: 8, height: 8, borderRadius: 999, background: GREEN }} />
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>LIVE</span>
        </div>
        <div style={{ fontSize: 19, fontWeight: 800, marginTop: 5 }}>
          いま世界で買える <span style={{ fontFamily: "ui-monospace, monospace" }}>{live.length}</span> 銘柄
        </div>
      </div>

      {/* 100gあたり価格軸 */}
      <div style={{ marginTop: 14 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", color: GRAY }}>
          PRICE / 100g
        </div>
        {ladder.map((b, i) => (
          <button key={b.id} onClick={() => onOpen(b)}
            style={{ display: "block", width: "100%", background: "none", border: "none", padding: "10px 0 0", cursor: "pointer", textAlign: "left" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>
                {b.status === "sold" && <span style={{ color: AMBER, fontSize: 9, fontFamily: "ui-monospace, monospace", marginRight: 6 }}>SOLD OUT</span>}
                {b.name}
              </span>
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: INK }}>{fmt100(b)}</span>
            </div>
            <div style={{ fontSize: 10, color: GRAY, marginTop: 1 }}>{ROASTERS[b.r].name} ・ {b.origin} ・ {b.process}</div>
            <div style={{ height: 6, background: "#F0EDE4", borderRadius: 3, marginTop: 5, overflow: "hidden" }}>
              <div className="bt-bar" style={{
                height: "100%", borderRadius: 3,
                width: `${(per100(b) / maxP) * 100}%`,
                background: b.status === "sold" ? LINE : `linear-gradient(90deg, ${GREEN}, #6B8F3C)`,
                animationDelay: `${0.15 + i * 0.09}s`,
              }} />
            </div>
          </button>
        ))}
      </div>

      {/* アーカイブ年表 */}
      {arc.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.12em", color: GRAY, borderBottom: `1px solid ${LINE}`, paddingBottom: 6 }}>
            {title} ARCHIVE — 消えたロットの記録
          </div>
          {years.map((yr) => (
            <div key={yr} style={{ display: "flex", gap: 14, marginTop: 12 }}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 700, color: GRAY, width: 42, flexShrink: 0, paddingTop: 2 }}>{yr}</div>
              <div style={{ flex: 1 }}>
                {arc.filter((b) => b.year === yr).map((b) => (
                  <button key={b.id} onClick={() => onOpen(b)}
                    style={{ display: "flex", gap: 10, width: "100%", background: "none", border: "none", padding: "0 0 12px", cursor: "pointer", textAlign: "left", alignItems: "center" }}>
                    <div style={{ width: 34, flexShrink: 0 }}><Package bean={b} small /></div>
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: INK }}>{b.name}</div>
                      <div style={{ fontSize: 10, color: GRAY }}>{ROASTERS[b.r].name} ・ {b.origin} ・ {b.process}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function GeishaView({ onOpen, onRoaster, cur }) {
  return (
    <div>
      {/* ページヘッダー */}
      <div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.2em", color: GRAY }}>RARE LOT</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          少量で消えていく希少な豆だけを追いかけるトラッカー。
        </div>
      </div>

      <VarietySection vt="geisha" title="GEISHA" sub="ゲイシャ品種" onOpen={onOpen} cur={cur} />
      <VarietySection vt="sidra" title="SIDRA" sub="シドラ品種" onOpen={onOpen} cur={cur} />

      {/* 新着通知CTA */}
      <div style={{ marginTop: 24, padding: "14px 16px", background: "#F2F0E9", borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>🔔 世界のどこかでレアロットが出たら、すぐ知る</div>
        <div style={{ fontSize: 11, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          巡回が新しいゲイシャやシドラを見つけた瞬間に通知します。少量ロットの売り切れ前に。
        </div>
        <button style={{ marginTop: 10, padding: "10px 18px", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          新着レアロット通知を受け取る<span style={{ fontSize: 9.5, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>プレミアム(v2)</span>
        </button>
      </div>

      {/* 今後のセクション予告 */}
      <div style={{ marginTop: 20, padding: "12px 14px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 11, color: GRAY, lineHeight: 1.8 }}>
        このタブは今後、AUCTION LOT(オークションロット)や COE(カップ・オブ・エクセレンス)入賞ロットなど、セクションを増やして育っていきます。
      </div>
    </div>
  );
}
