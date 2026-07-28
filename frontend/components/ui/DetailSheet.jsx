"use client";
import { useState, useEffect } from "react";
import { INK, PAPER, GRAY, LINE, GREEN, STATUS } from "../lib/theme";
import { RATES_TO_JPY, toJPY, fmtPrice, perGrams, fmtLocal } from "../lib/currency";
import { beanHref, beanLinkKind } from "../lib/utils";
import { getTasting, upsertTasting, removeTasting, isRestock, toggleRestock } from "../lib/store";
import { ROASTERS } from "../data/roasters";
import { Package } from "./Package";

export function DetailSheet({ bean, onClose, onRoaster, onFlavor, cur }) {
  const [rating, setRating] = useState(0);
  const [notes, setNotes] = useState("");
  const [saved, setSaved] = useState(false);
  const [watching, setWatching] = useState(false);
  useEffect(() => {
    if (!bean) return;
    const t = getTasting(bean.id);
    setRating(t ? t.rating : 0); setNotes(t ? t.notes : ""); setSaved(!!t);
    setWatching(isRestock(bean.id));
  }, [bean ? bean.id : null]);
  if (!bean) return null;
  const s = STATUS[bean.status];
  const roaster = ROASTERS[bean.r];
  const saveTasting = () => { if (!rating) return; upsertTasting({ beanId: bean.id, r: bean.r, name: bean.name, roaster: roaster.name, origin: bean.origin, rating, notes }); setSaved(true); };
  const delTasting = () => { removeTasting(bean.id); setRating(0); setNotes(""); setSaved(false); };
  const rows = [
    ["産地", bean.origin],
    ["精製", bean.process],
    ["現地価格", `${fmtLocal(bean)} / ${bean.per}`],
    [cur === "JPY" ? "円換算" : "ドル換算", `${fmtPrice(bean, cur)} / ${perGrams(bean)}g`],
    ["100gあたり", (() => {
      const jpy100 = (toJPY(bean) / perGrams(bean)) * 100;
      return cur === "JPY" ? `¥${Math.round(jpy100).toLocaleString()}` : `$${(jpy100 / RATES_TO_JPY.USD).toFixed(2)}`;
    })()],
    ["初出", bean.year],
  ];
  return (
    <div onClick={onClose} className="bt-overlay" style={{ position: "fixed", inset: 0, background: "rgba(23,21,15,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
      <div className="bt-sheet" onClick={(e) => e.stopPropagation()} style={{ background: PAPER, width: "100%", maxWidth: 480, borderRadius: "14px 14px 0 0", padding: "18px 20px 26px", maxHeight: "82vh", overflowY: "auto" }}>
        <div style={{ width: 34, height: 4, borderRadius: 999, background: LINE, margin: "0 auto 16px" }} />
        <div style={{ display: "flex", gap: 16 }}>
          <div className="bt-detail-pkg" style={{ width: 120, flexShrink: 0 }}><Package bean={bean} /></div>
          <div className="bt-detail-info" style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: s.dot }} />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: s.dot === GRAY ? GRAY : s.dot }}>{s.label} — {s.jp}</span>
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: INK, marginTop: 6, lineHeight: 1.25 }}>{bean.name}</div>
            <button onClick={() => { onClose(); onRoaster(bean.r); }} style={{ fontSize: 12, color: GRAY, marginTop: 3, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>
              {roaster.name} — {roaster.city}
            </button>
            <table style={{ marginTop: 12, fontSize: 12, color: INK, borderCollapse: "collapse", width: "100%" }}>
              <tbody>
                {rows.map(([k, v]) => (
                  <tr key={k} style={{ borderTop: `1px solid ${LINE}` }}>
                    <td style={{ padding: "6px 0", color: GRAY, fontSize: 11, width: 62 }}>{k}</td>
                    <td style={{ padding: "6px 0", fontFamily: "ui-monospace, monospace", fontSize: 11.5 }}>{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          {bean.status === "now" && (
            roaster.url ? (
              <a href={beanHref(roaster, bean)} target="_blank" rel="noopener noreferrer" style={{ display: "block", textDecoration: "none", width: "100%", padding: "13px 14px", boxSizing: "border-box", background: INK, color: PAPER, borderRadius: 8, cursor: "pointer" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                  <span style={{ fontSize: 15, fontWeight: 800 }}>この豆を買う ↗</span>
                  <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 12.5, opacity: 0.9 }}>{fmtPrice(bean, cur)} / {perGrams(bean)}g</span>
                </div>
                <div style={{ fontSize: 10.5, opacity: 0.75, marginTop: 3 }}>{roaster.name} の公式ECへ</div>
              </a>
            ) : (
              <div style={{ width: "100%", padding: "13px 0", background: "#EDEAE1", color: GRAY, borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: "center" }}>ECサイト準備中</div>
            )
          )}
          {bean.status === "sold" && (
            <>
              <button onClick={() => { toggleRestock({ beanId: bean.id, r: bean.r, name: bean.name, roaster: roaster.name }); setWatching(isRestock(bean.id)); }}
                style={{ width: "100%", padding: "13px 0", background: watching ? INK : PAPER, color: watching ? PAPER : INK, border: `1.5px solid ${INK}`, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {watching ? "✓ 再入荷ウォッチ中" : "🔔 再入荷を待つ"}
              </button>
              <div style={{ textAlign: "center", fontSize: 10, color: GRAY, marginTop: 8, lineHeight: 1.6 }}>
                {watching ? "再入荷したら通知します。ウォッチリストは「プレミアム」タブで確認できます。" : "この端末のウォッチリストに追加します（通知はプレミアムで有効化）。"}
              </div>
            </>
          )}
          {bean.status === "archive" && (
            <div style={{ textAlign: "center", fontSize: 11.5, color: GRAY, padding: "10px 0", borderTop: `1px solid ${LINE}` }}>
              この豆は販売を終了しています。図鑑の記録として保存されています。
            </div>
          )}
          {bean.status === "now" && roaster.url && (
            // 連動レベルを隠さず出す。直リンクなのか店内検索なのかで、押したあとの体験が変わるため。
            <div style={{ textAlign: "center", fontSize: 10, color: GRAY, marginTop: 8, lineHeight: 1.6 }}>
              {beanLinkKind(roaster, bean) === "direct"
                ? <>この豆の商品ページへ直接ひらきます</>
                : beanLinkKind(roaster, bean) === "search"
                  ? <>{roaster.url} 内でこの豆を検索した結果をひらきます</>
                  : <>{roaster.url} のトップページをひらきます</>}
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9.5, marginTop: 2 }}>↗ {roaster.url}</div>
            </div>
          )}
          {bean.status === "now" && onFlavor && (
            <button onClick={() => { onClose(); onFlavor(bean); }}
              style={{ width: "100%", marginTop: 10, padding: "11px 0", background: "none", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: "pointer" }}>
              🗺 味わいマップでこの豆を見る →
            </button>
          )}
        </div>

        {/* 飲んだ味を記録（ローカル保存） */}
        <div style={{ marginTop: 18, borderTop: `1px solid ${LINE}`, paddingTop: 14 }}>
          <div style={{ fontSize: 12.5, fontWeight: 700 }}>
            ☕ 飲んだ味を記録{saved && <span style={{ fontSize: 10, color: GREEN, marginLeft: 8 }}>保存済み</span>}
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} aria-label={`${n}点`}
                style={{ background: "none", border: "none", cursor: "pointer", fontSize: 24, lineHeight: 1, padding: 0, color: n <= rating ? "#E4A11B" : LINE }}>★</button>
            ))}
          </div>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="香り・酸味・甘み・余韻など、感じた味をメモ"
            style={{ width: "100%", boxSizing: "border-box", marginTop: 8, minHeight: 60, padding: "8px 10px", borderRadius: 8, border: `1px solid ${LINE}`, fontSize: 12.5, resize: "vertical", background: PAPER, color: INK, fontFamily: "inherit" }} />
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <button onClick={saveTasting} disabled={!rating}
              style={{ flex: 1, padding: "10px 0", background: rating ? INK : "#EDEAE1", color: rating ? PAPER : GRAY, border: "none", borderRadius: 8, fontSize: 12.5, fontWeight: 700, cursor: rating ? "pointer" : "default" }}>
              {saved ? "記録を更新" : "記録する"}
            </button>
            {saved && <button onClick={delTasting} style={{ padding: "10px 14px", background: "none", color: GRAY, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 12, cursor: "pointer" }}>削除</button>}
          </div>
          <div style={{ fontSize: 9.5, color: GRAY, marginTop: 6 }}>記録はこの端末に保存されます（「記録」タブで一覧）。</div>
        </div>
      </div>
    </div>
  );
}
