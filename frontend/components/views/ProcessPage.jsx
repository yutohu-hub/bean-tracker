"use client";
import { useState } from "react";
import { INK, PAPER, GRAY, LINE } from "../lib/theme";
import { RATES_TO_JPY, toJPY, perGrams } from "../lib/currency";
import { BEANS } from "../data/beans";
import { PROC, processKey } from "../lib/palette";
import { BeanCard } from "../ui/BeanCard";
import { FlavorMapView } from "./FlavorMapView";

// 精製方法ごとの一覧ページ。上部のチップで精製を切り替え、その精製の「いま買える」豆を並べる。
const ORDER = ["washed", "natural", "honey", "anatural", "awashed", "other"];
const JP = { washed: "水洗", natural: "ナチュラル", honey: "ハニー", anatural: "嫌気性ナチュラル", awashed: "嫌気性ウォッシュト", other: "その他" };
const DESC = {
  washed: "果肉を除いてから発酵・乾燥。クリーンで明るい酸味、輪郭のはっきりした味わい。",
  natural: "果実ごと乾燥。ベリーや完熟果実のような甘さと個性が出やすい。",
  honey: "粘液質を残して乾燥。水洗とナチュラルの中間、まろやかな甘み。",
  anatural: "酸素を遮断して発酵させたナチュラル。ワインやトロピカルな独特の風味。",
  awashed: "酸素を遮断して発酵させたウォッシュト。クリーンさに複雑なアロマが乗る。",
  other: "上記に分類されない精製・複合プロセス。",
};

export function ProcessPage({ pkey = "washed", onOpen, onRoaster, onBack, onProcess, cur = "JPY" }) {
  const [sort, setSort] = useState("price");
  const [mode, setMode] = useState("list");  // list | map
  const now = BEANS.filter((b) => b.status === "now");
  const per100 = (b) => (toJPY(b) / perGrams(b)) * 100;
  const fmt = (jpy) => cur === "JPY" ? `¥${Math.round(jpy).toLocaleString()}` : `$${(jpy / RATES_TO_JPY.USD).toFixed(0)}`;

  // 全精製の件数（チップ表示用）
  const counts = {};
  for (const b of now) { const k = processKey(b.process); counts[k] = (counts[k] || 0) + 1; }
  const chips = ORDER.filter((k) => counts[k]);
  const key = counts[pkey] ? pkey : (chips[0] || "washed");
  const st = PROC[key];

  let list = now.filter((b) => processKey(b.process) === key);
  const avg = list.length ? list.reduce((s, b) => s + per100(b), 0) / list.length : 0;
  list = list.slice().sort((a, b) => sort === "price" ? per100(a) - per100(b) : (b.updatedAt ? Date.parse(b.updatedAt) || 0 : 0) - (a.updatedAt ? Date.parse(a.updatedAt) || 0 : 0) || b.id - a.id);

  const selStyle = { padding: "7px 10px", borderRadius: 8, border: `1px solid ${LINE}`, background: PAPER, color: INK, fontSize: 12 };

  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", padding: 0, cursor: "pointer", fontSize: 12, color: GRAY }}>← 味わいマップに戻る</button>

      {/* 精製チップ（ページ切り替え） */}
      <div style={{ display: "flex", gap: 7, overflowX: "auto", paddingBottom: 8, marginTop: 10, WebkitOverflowScrolling: "touch" }}>
        {chips.map((k) => {
          const on = k === key;
          return (
            <button key={k} onClick={() => onProcess && onProcess(k)}
              style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 999, cursor: "pointer",
                border: `1px solid ${on ? PROC[k].bg : LINE}`, background: on ? PROC[k].bg : "transparent", color: on ? "#fff" : INK, fontSize: 11.5, fontWeight: on ? 700 : 400 }}>
              <span style={{ width: 8, height: 8, borderRadius: 3, background: on ? "#fff" : PROC[k].bg }} />
              {PROC[k].label}<span style={{ fontSize: 9.5, opacity: 0.85 }}>{counts[k]}</span>
            </button>
          );
        })}
      </div>

      {/* ヘッダー（その精製の色） */}
      <div style={{ marginTop: 6, padding: "16px 18px", borderRadius: 14, background: st.bg, color: st.accent }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", opacity: 0.85 }}>PROCESS</div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 4 }}>{st.label} <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.85 }}>{JP[key]}</span></div>
        <div style={{ fontSize: 12, marginTop: 8, lineHeight: 1.8, opacity: 0.95 }}>{DESC[key]}</div>
        <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
          <div><div style={{ fontFamily: "ui-monospace, monospace", fontSize: 20, fontWeight: 800 }}>{list.length}</div><div style={{ fontSize: 10, opacity: 0.85 }}>いま買える銘柄</div></div>
          <div><div style={{ fontFamily: "ui-monospace, monospace", fontSize: 20, fontWeight: 800 }}>{fmt(avg)}</div><div style={{ fontSize: 10, opacity: 0.85 }}>平均 / 100g</div></div>
        </div>
      </div>

      {/* 表示切り替え（一覧 / 味わいマップ）＋並び替え */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, gap: 10 }}>
        <div style={{ display: "flex", border: `1px solid ${INK}`, borderRadius: 8, overflow: "hidden" }}>
          {[["list", "☰ 一覧"], ["map", "🗺 味わいマップ"]].map(([m, l]) => (
            <button key={m} onClick={() => setMode(m)}
              style={{ padding: "7px 12px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700, background: mode === m ? INK : PAPER, color: mode === m ? PAPER : INK }}>{l}</button>
          ))}
        </div>
        {mode === "list" && (
          <select value={sort} onChange={(e) => setSort(e.target.value)} style={selStyle} aria-label="並び替え">
            <option value="price">100g安い順</option>
            <option value="new">新着順</option>
          </select>
        )}
      </div>

      {mode === "map" ? (
        <div style={{ marginTop: 14, maxWidth: 560, marginLeft: "auto", marginRight: "auto" }}>
          <FlavorMapView onOpen={onOpen} cur={cur} procOnly={key} embedded />
        </div>
      ) : (
        <>
          {/* 豆グリッド */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(132px, 1fr))", gap: 10, marginTop: 12 }}>
            {list.map((b) => <BeanCard key={b.id} bean={b} onOpen={onOpen} onRoaster={onRoaster} cur={cur} />)}
          </div>
          {list.length === 0 && <div style={{ textAlign: "center", color: GRAY, fontSize: 12, padding: "50px 0" }}>この精製の在庫はいまありません。</div>}
        </>
      )}
    </div>
  );
}
