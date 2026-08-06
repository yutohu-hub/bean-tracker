"use client";
import { INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";
import { RATES_TO_JPY, per100JPY } from "../lib/currency";
import { usePlan } from "../lib/usePlan";
import { beanHref } from "../lib/utils";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";

function VarietySection({ match, title, sub, onOpen, cur, limit, premium, onPremium }) {
  // いま買える(now)豆のみ・100gあたり価格の安い順（袋の大きさが店ごとに違うため）
  // 送客先ECのあるロースターに限定（「ECサイト準備中」はレアロットに出さない）
  // 表示件数の上限はプランで決まる（lib/entitlements.js の LIMITS が唯一の出どころ）
  // 値段が取れなかった豆（amount=0）は最初から除く
  const live = BEANS.filter((b) => b.status === "now" && match(b)
    && ROASTERS[b.r] && ROASTERS[b.r].url && Number(b.amount) > 0);
  // 整数まるめだと $9.2 と $9.6 が同じに見える。桁が下がるぶんだけ小数を伸ばす。
  const fmtUsd = (v) => v.toFixed(v < 1 ? 2 : v < 10 ? 1 : 0);
  // 換算して1円に満たない額は、値段として使える数字ではない（取得できていないか、
  // 桁が落ちている）。0円と表示して最安の席に座らせず、末尾に「価格不明」で置く。
  const priced = (b) => per100JPY(b) >= 1;
  const fmt100 = (b) => !priced(b) ? "価格不明"
    : cur === "JPY"
      ? `¥${Math.round(per100JPY(b)).toLocaleString()}`
      : `$${fmtUsd(per100JPY(b) / RATES_TO_JPY.USD)}`;
  const sorted = live.slice().sort((a, b) => {
    if (priced(a) !== priced(b)) return priced(a) ? -1 : 1;
    return per100JPY(a) - per100JPY(b);
  });
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
                  width: `${(per100JPY(b) / maxP) * 100}%`,
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
          <div style={{ fontSize: 11, color: GRAY, padding: "14px 0", lineHeight: 1.7 }}>
            いま買える{title}はありません。<br />
            巡回が各ロースターのECで見つけ次第ここに並びます。
          </div>
        )}
        {!premium && locked > 0 && (
          <button onClick={onPremium}
            style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 12, padding: "12px 0", background: "#F2F0E9", color: INK, border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            🔒 あと {locked} 銘柄あります。プレミアムで全件表示 ↗
          </button>
        )}
        {premium && locked > 0 && (
          <div style={{ fontSize: 10.5, color: GRAY, marginTop: 10, textAlign: "center" }}>上位30銘柄を表示中（ほか {locked} 銘柄）</div>
        )}
      </div>
    </div>
  );
}

export function GeishaView({ onOpen, cur, onPremium }) {
  const { premium, limits } = usePlan();
  const limit = limits.rareLots;
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
          {premium ? "プレミアム：全銘柄を表示中" : `無料プランは各カテゴリ ${limit} 銘柄まで。プレミアムで全件表示`}
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
      {/* COE。順位まで書く店は少ないので、店が COE と名乗っていることを条件にしている。
          「20位以内・エチオピア以外」という条件だったころは、その書式で書くのが
          手書きの豆だけだったため、巡回で取れた入賞ロットが1件も並ばなかった。 */}
      <VarietySection match={(b) => b.coe === true || /COE\s*\d+位/.test(b.name)} title="COE" sub="カップ・オブ・エクセレンスの入賞ロット・入賞農園" {...secProps} />
      {/* CGLE = Café Granja La Esperanza 農園のロット。
          農園名の文字列一致では拾わない（"La Esperanza" は中南米に同名農園が多く、
          "Granja Paraíso 92" は名前が似ているだけの別農園）。
          店が CGLE と明記しているか、この生産者固有の農園名が出ているものだけ。 */}
      <VarietySection match={(b) => b.cgle === true} title="CGLE" sub="Café Granja La Esperanza（Cerro Azul・Las Margaritas 等の農園ロット）" {...secProps} />

      {/* 今後のセクション予告 */}
      <div style={{ marginTop: 20, padding: "12px 14px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 11, color: GRAY, lineHeight: 1.8 }}>
        このタブは今後、AUCTION LOT(オークションロット)など、セクションを増やして育っていきます。
      </div>
    </div>
  );
}
