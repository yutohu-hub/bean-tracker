"use client";
import { useState } from "react";
import { FS, INK, PAPER, GRAY, LINE } from "../lib/theme";
import { shopHref, mapHref } from "../lib/utils";
import { getArchivedBeans } from "../lib/store";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";
import { BeanCard } from "../ui/BeanCard";

export function RoasterPage({ rid, onOpen, onBack, onRoaster, initialTab, cur }) {
  const roaster = ROASTERS[rid];
  const [tab, setTab] = useState(initialTab || "now");
  const beans = BEANS.filter((b) => b.r === rid);
  const byStatus = (st) => beans.filter((b) => b.status === st);
  // アーカイブは端末に永続化したスナップショットとマージ（更新で消えても残す）
  const archiveMerged = (() => {
    const m = new Map();
    for (const b of byStatus("archive")) m.set(b.id, b);
    for (const b of getArchivedBeans()) if (b.r === rid && !m.has(b.id)) m.set(b.id, b);
    return Array.from(m.values());
  })();
  const listFor = (st) => (st === "archive" ? archiveMerged : byStatus(st));
  const tabs = [
    { key: "now", label: "NOW", n: byStatus("now").length },
    { key: "sold", label: "SOLD OUT", n: byStatus("sold").length },
    { key: "archive", label: "ARCHIVE", n: archiveMerged.length },
  ];
  return (
    <div>
      <button onClick={onBack} style={{ background: "none", border: "none", color: GRAY, fontSize: FS.body, padding: "2px 0 12px", cursor: "pointer" }}>← 図鑑にもどる</button>
      <div style={{ borderTop: `2px solid ${INK}`, paddingTop: 14 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <h2 style={{ fontSize: FS.title, fontWeight: 700, color: INK, margin: 0 }}>{roaster.name}</h2>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY }}>{roaster.country} / {roaster.platform}</span>
        </div>
        <div style={{ fontSize: FS.body, color: GRAY, marginTop: 4 }}>{roaster.city}{roaster.note && roaster.note !== "—" ? ` — ${roaster.note}` : ""}</div>
        {(() => {
          const meta = [["創業", roaster.founded], ["焙煎", roaster.style], ["発送", roaster.ship], ["得意産地", roaster.focus]]
            .filter(([, v]) => v && v !== "—");
          if (meta.length === 0) return null;
          return (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginTop: 12, padding: "10px 12px", background: "#F2F0E9", borderRadius: 8 }}>
              {meta.map(([k, v]) => (
                <div key={k}>
                  <div style={{ fontSize: FS.meta, color: GRAY, letterSpacing: "0.06em" }}>{k}</div>
                  <div style={{ fontSize: FS.meta, color: INK, marginTop: 1, fontWeight: 600 }}>{v}</div>
                </div>
              ))}
            </div>
          );
        })()}
        {roaster.bio && roaster.bio !== "—" && (
          <p style={{ fontSize: FS.body, color: INK, lineHeight: 1.85, marginTop: 12, marginBottom: 0 }}>{roaster.bio}</p>
        )}
      </div>
      {roaster.url && (
        <a href={shopHref(roaster)} target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 14, padding: "12px 0", background: INK, color: PAPER, borderRadius: 8, fontSize: FS.body, fontWeight: 700, textDecoration: "none" }}>
          {roaster.name} のECサイトで見る ↗
        </a>
      )}
      {roaster.url && (
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY, marginTop: 6, textAlign: "center" }}>{roaster.url} へ送客（utm付き）</div>
      )}
      <a href={mapHref(roaster)} target="_blank" rel="noopener noreferrer"
        style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 6, width: "100%", marginTop: 8, padding: "10px 0", background: "none", color: INK, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: FS.body, fontWeight: 700, textDecoration: "none" }}>
        🗺 Google マップで場所を見る ↗
      </a>
      <div style={{ display: "flex", gap: 0, marginTop: 18, borderBottom: `1px solid ${LINE}` }}>
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "9px 0", background: "none", border: "none", cursor: "pointer",
              fontFamily: "ui-monospace, monospace", fontSize: FS.meta, letterSpacing: "0.05em",
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
          const arc = archiveMerged;
          const years = [...new Set(arc.map((b) => b.year))].sort((a, b) => b - a);
          return years.map((yr) => (
            <div key={yr} style={{ marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 8, borderBottom: `1px solid ${LINE}`, paddingBottom: 6 }}>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.lead, fontWeight: 700, color: INK }}>{yr}</span>
                <span style={{ fontSize: FS.meta, color: GRAY }}>{arc.filter((b) => b.year === yr).length} 銘柄</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 14 }}>
                {arc.filter((b) => b.year === yr).map((b) => <BeanCard key={b.id} bean={b} onOpen={onOpen} onRoaster={onRoaster} cur={cur} />)}
              </div>
            </div>
          ));
        })()
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 16, marginTop: 18 }}>
          {listFor(tab).map((b) => <BeanCard key={b.id} bean={b} onOpen={onOpen} onRoaster={onRoaster} cur={cur} />)}
        </div>
      )}
      {listFor(tab).length === 0 && (
        <div style={{ textAlign: "center", color: GRAY, fontSize: FS.body, padding: "40px 0" }}>このカテゴリの豆はまだありません。</div>
      )}
      {tab === "archive" && archiveMerged.length > 0 && (
        <div style={{ marginTop: 20, fontSize: FS.meta, color: GRAY, borderTop: `1px solid ${LINE}`, paddingTop: 12 }}>
          ARCHIVEは巡回で「ページが消えた」豆を自動保存した記録です。{roaster.name}の歴代ラインナップとして残ります。
        </div>
      )}
    </div>
  );
}
