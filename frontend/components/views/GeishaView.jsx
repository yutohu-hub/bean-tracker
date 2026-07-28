"use client";
import { useState, useEffect } from "react";
import { INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";
import { RATES_TO_JPY, toJPY, perGrams } from "../lib/currency";
import { getPlan } from "../lib/store";
import { beanHref } from "../lib/utils";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";

function VarietySection({ match, title, sub, onOpen, cur, limit, premium, onPremium }) {
  // いま買える(now)豆のみ・100gあたり価格の安い順
  // 送客先ECのあるロースターに限定（「ECサイト準備中」はレアロットに出さない）
  // 無料は最大10銘柄、プレミアムは最大50銘柄まで表示
  const live = BEANS.filter((b) => b.status === "now" && match(b) && ROASTERS[b.r] && ROASTERS[b.r].url);
  const per100 = (b) => (toJPY(b) / perGrams(b)) * 100;
  const fmt100 = (b) => cur === "JPY" ? `¥${Math.round(per100(b)).toLocaleString()}` : `$${(per100(b) / RATES_TO_JPY.USD).toFixed(0)}`;
  const sorted = live.slice().sort((a, b) => per100(a) - per100(b));
  const ladder = sorted.slice(0, limit);
  const locked = Math.max(0, sorted.length - ladder.length);
  const maxP = ladder.length ? Math.max(...ladder.map(per100)) : 1;

  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.08em" }}>{title}</span>
        <span style={{ fontSize: 10, color: GRAY }}>{sub}</span>
      </div>

      {/* ライブカウンター */}
      <div style={{ borderTop: `2px solid ${INK}`, borderBottom: `1px solid ${LINE}`, padding: "12px 0", marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="bt-live" style={{ width: 8, height: 8, borderRadius: 999, background: "#E0332B", boxShadow: "0 0 0 3px rgba(224,51,43,0.18)" }} />
          <span className="bt-live" style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: "#E0332B", fontWeight: 700 }}>LIVE</span>
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
          <div key={b.id} style={{ display: "flex", alignItems: "flex-end", gap: 10, padding: "10px 0 0" }}>
            <button onClick={() => onOpen(b)}
              style={{ display: "block", flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, cursor: "pointer", textAlign: "left" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: INK }}>{b.name}</span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: INK }}>{fmt100(b)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, marginTop: 1 }}>
                <span style={{ fontSize: 10, color: GRAY }}>{ROASTERS[b.r].name} ・ {b.origin} ・ {b.process}</span>
                <span style={{ fontSize: 10, color: GREEN, fontWeight: 700, flexShrink: 0 }}>豆の詳細 ›</span>
              </div>
              <div style={{ height: 6, background: "#F0EDE4", borderRadius: 3, marginTop: 5, overflow: "hidden" }}>
                <div className="bt-bar" style={{
                  height: "100%", borderRadius: 3,
                  width: `${(per100(b) / maxP) * 100}%`,
                  background: `linear-gradient(90deg, ${GREEN}, #6B8F3C)`,
                  animationDelay: `${0.15 + i * 0.09}s`,
                }} />
              </div>
            </button>
            {/* レアロットは売り切れるのが速い。一覧から直接ECへ行けるようにする */}
            <a href={beanHref(ROASTERS[b.r], b)} target="_blank" rel="noopener noreferrer"
              style={{ flexShrink: 0, textDecoration: "none", padding: "7px 12px", background: INK, color: PAPER, borderRadius: 6, fontSize: 11, fontWeight: 700, whiteSpace: "nowrap" }}>
              買う ↗
            </a>
          </div>
        ))}
        {ladder.length === 0 && (
          <div style={{ fontSize: 11, color: GRAY, padding: "14px 0" }}>いま買える{title}はありません。</div>
        )}
        {!premium && locked > 0 && (
          <button onClick={onPremium}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 12, padding: "12px 0", background: "#F2F0E9", color: INK, border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            🔒 さらに {locked} 銘柄。プレミアムで最大30銘柄まで表示 ↗
          </button>
        )}
        {premium && locked > 0 && (
          <div style={{ fontSize: 10.5, color: GRAY, marginTop: 10, textAlign: "center" }}>上位30銘柄を表示中（ほか {locked} 銘柄）</div>
        )}
      </div>
    </div>
  );
}

export function GeishaView({ onOpen, onRoaster, cur, onPremium }) {
  const [premium, setPremium] = useState(false);
  useEffect(() => { setPremium(getPlan().id.startsWith("premium")); }, []);
  const limit = premium ? 30 : 10;
  const secProps = { onOpen, cur, limit, premium, onPremium };
  return (
    <div>
      {/* ページヘッダー */}
      <div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.2em", color: GRAY }}>RARE LOT</div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          少量で消えていく希少な豆だけを追いかけるトラッカー。
        </div>
        <div style={{ marginTop: 8, fontSize: 11, color: premium ? GREEN : GRAY }}>
          {premium ? "プレミアム：各カテゴリ最大30銘柄まで表示中" : "無料プランは各カテゴリ10銘柄まで。プレミアムで30銘柄まで表示"}
        </div>
      </div>

      {/* 新着通知CTA（geishaの上） */}
      <div style={{ marginTop: 18, padding: "14px 16px", background: "#F2F0E9", borderRadius: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>🔔 世界のどこかでレアロットが出たら、すぐ知る</div>
        <div style={{ fontSize: 11, color: GRAY, marginTop: 4, lineHeight: 1.7 }}>
          巡回が新しいゲイシャやシドラを見つけた瞬間に通知します。少量ロットの売り切れ前に。
        </div>
        <button onClick={onPremium} style={{ marginTop: 10, padding: "10px 18px", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
          新着レアロット通知を受け取る<span style={{ fontSize: 9.5, fontWeight: 400, marginLeft: 8, opacity: 0.7 }}>プレミアム ↗</span>
        </button>
      </div>

      <VarietySection match={(b) => b.vt === "geisha"} title="GEISHA" sub="ゲイシャ品種" {...secProps} />
      <VarietySection match={(b) => b.vt === "sidra"} title="SIDRA" sub="シドラ品種" {...secProps} />
      <VarietySection match={(b) => { const m = b.name.match(/COE\s*(\d+)位/); return !!m && Number(m[1]) <= 20 && b.origin !== "エチオピア"; }} title="COE" sub="カップ・オブ・エクセレンス入賞ロット（20位以内・エチオピア以外）" {...secProps} />
      {/* CGLE = Café Granja La Esperanza 農園のロット。
          農園名の文字列一致では拾わない（"La Esperanza"/"Las Margaritas" は中南米に同名農園が多く誤検出するため）。
          ECの商品ページを確認できたロットに data 側で cgle: true を立て、それだけを表示する。 */}
      <VarietySection match={(b) => b.cgle === true} title="CGLE" sub="Café Granja La Esperanza（Cerro Azul・Las Margaritas 等の農園ロット）" {...secProps} />

      {/* 今後のセクション予告 */}
      <div style={{ marginTop: 20, padding: "12px 14px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 11, color: GRAY, lineHeight: 1.8 }}>
        このタブは今後、AUCTION LOT(オークションロット)など、セクションを増やして育っていきます。
      </div>
    </div>
  );
}
