"use client";
import { INK, GRAY, STATUS } from "../lib/theme";
import { fmtPrice, perGrams } from "../lib/currency";
import { ROASTERS } from "../data/roasters";
import { Package } from "./Package";

export function BeanCard({ bean, onOpen, onRoaster, cur }) {
  const s = STATUS[bean.status];
  return (
    <div className="bt-card" style={{ cursor: "pointer" }} onClick={() => onOpen(bean)}>
      <Package bean={bean} small />
      <div style={{ padding: "8px 2px 0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
          <span style={{ width: 6, height: 6, borderRadius: 999, background: s.dot, flexShrink: 0 }} />
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: s.dot === GRAY ? GRAY : s.dot, letterSpacing: "0.06em" }}>{s.label}</span>
          {bean.status !== "archive" && (
            <span style={{ marginLeft: "auto", fontFamily: "ui-monospace, monospace", fontSize: 9, color: INK }}>{fmtPrice(bean, cur)}/{perGrams(bean)}g</span>
          )}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: INK, marginTop: 3, lineHeight: 1.3 }}>{bean.name}</div>
        <button
          onClick={(e) => { e.stopPropagation(); onRoaster(bean.r); }}
          style={{ fontSize: 10.5, color: GRAY, marginTop: 2, background: "none", border: "none", padding: 0, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}
        >
          {ROASTERS[bean.r].name}
        </button>
      </div>
    </div>
  );
}
