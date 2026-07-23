"use client";
import { useState } from "react";
import { INK, PAPER, GRAY, LINE } from "../lib/theme";
import { shopHref } from "../lib/utils";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";

export function RoasterPage({ rid, onOpen, onBack, onRoaster, initialTab, cur }) {
  const roaster = ROASTERS[rid];
  const [tab, setTab] = useState(initialTab || "now");
  const beans = BEANS.filter((b) => b.r === rid);
  const byStatus = (st) => beans.filter((b) => b.status === st);
  const tabs = [
    { key: "now", label: "NOW", n: byStatus("now").length },
    { key: "sold", label: "SOLD OUT", n: byStatus("sold").length },
    { key: "archive", label: "ARCHIVE", n: byStatus("archive").length },
  ];
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: GRAY, fontSize: 12, padding: "2px 0 12px", cursor: "pointer" }}>← 図鑑にもどる</button>
      <div style={{ borderTop: `2px solid ${INK}`, paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: INK, margin: 0 }}>{roaster.name}</h2>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY }}>{roaster.country} / {roaster.platform}</span>
        </div>
        <div style={{ fontSize: 12, color: GRAY, marginTop: 4 }}>{roaster.city} — {roaster.note}</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginTop: 12, padding: "10px 12px", background: "#F2F0E9", borderRadius: 8 }}>
          {[["創業", roaster.founded], ["焙煎", roaster.style], ["発送", roaster.ship], ["得意産地", roaster.focus]].map(([k, v]) => (
            <div key={k}>
              <div style={{ fontSize: 9, color: GRAY, letterSpacing: "0.06em" }}>{k}</div>
              <div style={{ fontSize: 11, color: INK, marginTop: 1, fontWeight: 600 }}>{v}</div>
            </div>
          ))}
        </div>
        <p style={{ fontSize: 12, color: INK, lineHeight: 1.85, marginTop: 12, marginBottom: 0 }}>{roaster.bio}</p>
      </div>
      {roaster.url && (
        <a href={shopHref(roaster)} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 14, padding: "12px 0", background: INK, color: PAPER, borderRadius: 8, fontSize: 13, fontWeight: 700, textDecoration: "none" }}>
          {roaster.name} のECサイトで見る ↗
        </a>
      )}
      {roaster.url && (
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 9.5, color: GRAY, marginTop: 6, textAlign: "center" }}>{roaster.url} へ送客（utm付き）</div>
      )}
      <div style={{ display: "flex", gap: 0, marginTop: 18, borderBottom: `1px solid ${LINE}` }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "9px 0", background: "none", border: "none", cursor: "pointer",
              fontFamily: "ui-monospace, monospace", fontSize: 11, letterSpacing: "0.05em",
              color: tab === t.key ? INK : GRAY, fontWeight: tab === t.key ? 700 : 400,
              borderBottom: tab === t.key ? `2px solid ${INK}` : "2px solid transparent",
            }}>
            {t.label} <span style={{ opacity: 0.6 }}>{t.n}</span>
          </button>
        ))}
      </div>
      {tab === "archive" ? (
        /* 年別の歴代ポートフォリオ */
        (() => {
          const arc = byStatus("archive");
          const years = [...new Set(arc.map((b) => b.year))].sort((a, b) => b - a);
          return years.map((yr) => (
            <div key={yr} style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 6 }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 15, fontWeight: 700, color: INK }}>{yr}</span>
                <span style={{ fontSize: 10, color: GRAY }}>{arc.filter((b) => b.year === yr).length} 銘柄</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 14 }}>
                {arc.filter((b) => b.year === yr).map((b) => <BeanCard key={b.id} bean={b} onOpen={onOpen} onRoaster={onRoaster} cur={cur} />)}
              </div>
            </div>
          ));
        })()
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 18 }}>
          {byStatus(tab).map((b) => <BeanCard key={b.id} bean={b} onOpen={onOpen} onRoaster={onRoaster} cur={cur} />)}
        </div>
      )}
      {byStatus(tab).length === 0 && (
        <div style={{ textAlign: "center", color: GRAY, fontSize: 12, padding: "40px 0" }}>このカテゴリの豆はまだありません。</div>
      )}
      {tab === "archive" && byStatus("archive").length > 0 && (
        <div style={{ marginTop: 20, fontSize: 11, color: GRAY, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
          ARCHIVEは巡回で「ページが消えた」豆を自動保存した記録です。{roaster.name}の歴代ラインナップとして残ります。
        </div>
      )}
    </div>
  );
}
