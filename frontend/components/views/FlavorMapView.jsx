"use client";
import { useState } from "react";
import { INK, PAPER, GRAY, LINE, STATUS } from "../lib/theme";
import { fmtPrice, perGrams } from "../lib/currency";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";
import { FLAVORS, FLAVOR_MAP } from "../data/flavors";
import { Package } from "../ui/Package";

export function FlavorMapView({ onOpen, cur }) {
  const [famF, setFamF] = useState(null);     // 系統ハイライト
  const [selId, setSelId] = useState(null);   // 選択中の豆
  const beans = BEANS.filter((b) => FLAVOR_MAP[b.id]);
  const sel = beans.find((b) => b.id === selId);

  return (
    <div>
      <div style={{ fontSize: 11, color: GRAY, marginBottom: 10 }}>
        いま買える豆を、味わいの座標で。●をタップすると豆の詳細が出ます。
      </div>

      {/* 系統の凡例（タップでハイライト） */}
      <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 8, WebkitOverflowScrolling: "touch" }}>
        {Object.entries(FLAVORS).map(([k, f]) => (
          <button key={k} onClick={() => setFamF(famF === k ? null : k)}
            style={{
              flexShrink: 0, display: "flex", alignItems: "center", gap: 5,
              padding: "5px 11px", borderRadius: 999, fontSize: 11, cursor: "pointer",
              border: `1px solid ${famF === k ? f.color : LINE}`,
              background: famF === k ? f.color : "transparent",
              color: famF === k ? "#fff" : INK,
              transition: "all 0.2s ease",
            }}>
            <span style={{ width: 8, height: 8, borderRadius: 999, background: famF === k ? "#fff" : f.color }} />
            {f.label}
          </button>
        ))}
      </div>

      {/* マップ本体 */}
      <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", marginTop: 6,
        borderRadius: 12, border: `1.4px solid ${INK}`, overflow: "hidden",
        background: `
          radial-gradient(at 15% 12%, rgba(217,180,65,0.13), transparent 55%),
          radial-gradient(at 85% 12%, rgba(217,140,166,0.14), transparent 55%),
          radial-gradient(at 85% 88%, rgba(124,77,143,0.12), transparent 55%),
          radial-gradient(at 15% 88%, rgba(122,82,50,0.13), transparent 55%),
          #FCFBF8` }}>
        {/* 十字の補助線 */}
        <div style={{ position: "absolute", left: "50%", top: 0, bottom: 0, width: 1, background: LINE }} />
        <div style={{ position: "absolute", top: "50%", left: 0, right: 0, height: 1, background: LINE }} />
        {/* 軸ラベル */}
        <span style={{ position: "absolute", top: 6, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>明るい・すっきり</span>
        <span style={{ position: "absolute", bottom: 6, left: "50%", transform: "translateX(-50%)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>深い・コク</span>
        <span style={{ position: "absolute", left: 8, top: "50%", transform: "translate(-30%, -50%) rotate(-90deg)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>クリーン</span>
        <span style={{ position: "absolute", right: 8, top: "50%", transform: "translate(30%, -50%) rotate(90deg)", fontSize: 9, color: GRAY, letterSpacing: "0.15em" }}>個性派</span>

        {/* 豆のドット */}
        {beans.map((b, i) => {
          const m = FLAVOR_MAP[b.id];
          const f = FLAVORS[m.fam];
          const dimmed = famF && famF !== m.fam;
          const isSel = selId === b.id;
          return (
            <button key={b.id} onClick={() => setSelId(isSel ? null : b.id)}
              className="bt-dot"
              style={{
                position: "absolute", left: `${m.fx}%`, top: `${m.fy}%`,
                width: 30, height: 30, marginLeft: -15, marginTop: -15,
                background: "transparent", border: "none", cursor: "pointer", padding: 0,
                animationDelay: `${0.35 + i * 0.06}s`,
                opacity: dimmed ? 0.15 : 1,
                transition: "opacity 0.25s ease",
                zIndex: isSel ? 5 : 1,
              }}>
              <span className={isSel ? "bt-dot-core bt-dot-sel" : "bt-dot-core"}
                style={{
                  display: "block", width: 14, height: 14, margin: "8px auto",
                  borderRadius: 999,
                  background: b.status === "sold" ? "transparent" : f.color,
                  border: `3px solid ${f.color}`,
                  boxShadow: isSel ? `0 0 0 5px ${f.color}33` : "0 1px 3px rgba(23,21,15,0.2)",
                  animationDelay: `${i * 0.4}s`,
                }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 9.5, color: GRAY, marginTop: 6 }}>
        <span>● 在庫あり　○ 売り切れ</span>
        <span>座標は精製・焙煎からの位置づけ（優劣ではありません）</span>
      </div>

      {/* 選択中の豆カード */}
      {sel && (
        <div className="bt-card" key={sel.id} style={{ display: "flex", gap: 14, borderTop: `2px solid ${INK}`, marginTop: 12, paddingTop: 14 }}>
          <div style={{ width: 84, flexShrink: 0 }}><Package bean={sel} small /></div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 9, height: 9, borderRadius: 999, background: FLAVORS[FLAVOR_MAP[sel.id].fam].color }} />
              <span style={{ fontSize: 10.5, color: GRAY }}>{FLAVORS[FLAVOR_MAP[sel.id].fam].label} — {FLAVOR_MAP[sel.id].notes}</span>
            </div>
            <div style={{ fontSize: 14.5, fontWeight: 700, marginTop: 4 }}>{sel.name}</div>
            <div style={{ fontSize: 11, color: GRAY, marginTop: 2 }}>
              {ROASTERS[sel.r].name} ・ {STATUS[sel.status].jp} ・ {fmtPrice(sel, cur)}/{perGrams(sel)}g
            </div>
            <button onClick={() => onOpen(sel)}
              style={{ marginTop: 10, padding: "9px 18px", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              詳しく見る →
            </button>
          </div>
        </div>
      )}
      {!sel && (
        <div style={{ textAlign: "center", fontSize: 10.5, color: GRAY, marginTop: 14 }}>
          右上ほど個性的で明るく、左下ほどクラシックで深い味わいです
        </div>
      )}
    </div>
  );
}
