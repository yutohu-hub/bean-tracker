"use client";
import { INK, PAPER, GRAY, LINE, STATUS } from "../lib/theme";
import { RATES_TO_JPY, toJPY, fmtPrice, perGrams, fmtLocal } from "../lib/currency";
import { shopHref } from "../lib/utils";
import { ROASTERS } from "../data/roasters";
import { Package } from "./Package";

export function DetailSheet({ bean, onClose, onRoaster, cur }) {
  if (!bean) return null;
  const s = STATUS[bean.status];
  const roaster = ROASTERS[bean.r];
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
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(23,21,15,0.45)", zIndex: 50, display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
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
              <a href={shopHref(roaster)} target="_blank" rel="noopener noreferrer" style={{ display: "block", textAlign: "center", textDecoration: "none", width: "100%", padding: "13px 0", background: INK, color: PAPER, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                {roaster.name} のECで見る ↗
              </a>
            ) : (
              <div style={{ width: "100%", padding: "13px 0", background: "#EDEAE1", color: GRAY, borderRadius: 8, fontSize: 13, fontWeight: 700, textAlign: "center" }}>ECサイト準備中</div>
            )
          )}
          {bean.status === "sold" && (
            <button style={{ width: "100%", padding: "13px 0", background: PAPER, color: INK, border: `1.5px solid ${INK}`, borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
              🔔 再入荷を待つ<span style={{ fontSize: 10, color: GRAY, fontWeight: 400, marginLeft: 8 }}>プレミアム機能(v2)</span>
            </button>
          )}
          {bean.status === "archive" && (
            <div style={{ textAlign: "center", fontSize: 11.5, color: GRAY, padding: "10px 0", borderTop: `1px solid ${LINE}` }}>
              この豆は販売を終了しています。図鑑の記録として保存されています。
            </div>
          )}
          {bean.status === "now" && roaster.url && (
            <div style={{ textAlign: "center", fontSize: 10, color: GRAY, marginTop: 8, fontFamily: "ui-monospace, monospace" }}>
              ↗ {roaster.url} へ送客（/go/{String(bean.id).padStart(4, "0")}・utm付き）
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
