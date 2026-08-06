"use client";
import { useState } from "react";
import { INK, PAPER, GRAY, STATUS } from "../lib/theme";
import { fmtPrice, fmtJPY, per100JPY, perGrams } from "../lib/currency";
import { ROASTERS } from "../data/roasters";
import { isNew, beanHref } from "../lib/utils";
import { Package } from "./Package";

export function BeanCard({ bean, onOpen, onRoaster, cur }) {
  const s = STATUS[bean.status];
  const roaster = ROASTERS[bean.r];
  // いま買える豆は、詳細シートを開かずカードから直接ECへ行けるようにする
  const buyable = bean.status === "now" && roaster && roaster.url;
  const [tap, setTap] = useState(false);
  const per100Str = fmtJPY(per100JPY(bean), cur);
  const handleTap = () => { setTap(true); setTimeout(() => { setTap(false); onOpen(bean); }, 200); };
  return (
    <div className={`bt-card${tap ? " bt-card-tap" : ""}`} style={{ cursor: "pointer", position: "relative" }} onClick={handleTap}>
      {isNew(bean) && (
        <span style={{ position: "absolute", top: 6, left: 6, zIndex: 2, fontFamily: "ui-monospace, monospace", fontSize: 8.5, fontWeight: 800, letterSpacing: "0.08em", color: "#fff", background: "#B8433A", borderRadius: 4, padding: "2px 6px", boxShadow: "0 1px 3px rgba(23,21,15,0.25)" }}>NEW</span>
      )}
      <Package bean={bean} small />
      <div style={{ padding: "8px 2px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: s.dot === GRAY ? GRAY : s.dot, letterSpacing: "0.06em" }}>{s.label}</span>
          <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 9, color: INK }} title="1袋あたりの価格">{fmtPrice(bean, cur)}/{perGrams(bean)}g</span>
        </div>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: GRAY, marginTop: 2 }} title="100gあたりに正規化した価格（比較用）">{per100Str}/100g</div>
        <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginTop: 3, lineHeight: 1.3 }}>{bean.name}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onRoaster(bean.r); }}
          style={{ fontSize: 10.5, color: GRAY, marginTop: 2, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          {roaster.name}
        </button>
        {buyable && (
          <a
            href={beanHref(roaster, bean)} target="_blank" rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            style={{ display: "block", textAlign: "center", textDecoration: "none", marginTop: 7, padding: "7px 0", background: INK, color: PAPER, borderRadius: 6, fontSize: 11, fontWeight: 700 }}
          >
            買う ↗
          </a>
        )}
      </div>
    </div>
  );
}
