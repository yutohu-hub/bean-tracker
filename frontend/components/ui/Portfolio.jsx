"use client";
// 記録（tastings）だけを材料に、その人の飲み方を組み立てる。
//
// 以前は同じ横棒の節が7つ縦に並んでいて、スクロールばかり長く、
// どれも同じ見た目なので違いが頭に入らなかった。形を変えて縦を詰める。
//   * 数字        → 1行に畳んだタイル
//   * いつ飲んだか → カレンダー（棒6本より小さく、密度は高い）
//   * どんな味か   → 味わいマップと同じ座標に自分の記録を打つ
//   * 内訳        → 産地・精製・評価を切り替えて1つずつ・2列
//   * 行き先のあるもの（ロースター・お気に入り）だけ従来どおり一覧

import { useState } from "react";
import { FS, INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";
import { toJPY } from "../lib/currency";
import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { ORIGIN_GROUP, GROUP_LABEL } from "../lib/analysis";
import { PROC, processKey } from "../lib/palette";
import { FLAVORS, flavorOf } from "../data/flavors";
import { beanHref } from "../lib/utils";

const DAY_MS = 86400000;
const WEEKS = 18;            // カレンダーに出す週数（およそ4か月）

function Section({ title, sub, children, right }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: FS.body, fontWeight: 800 }}>{title}</span>
          {sub && <span style={{ fontSize: FS.meta, color: GRAY }}>{sub}</span>}
        </div>
        {right}
      </div>
      <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 6, paddingTop: 9 }}>{children}</div>
    </div>
  );
}

/* 細い横棒。数はいつも文字でも出す（色や長さだけに意味を持たせない） */
function Bar({ label, n, max, color = INK, onClick }) {
  const inner = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: FS.meta, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, color: GRAY, flexShrink: 0 }}>{n}</span>
      </div>
      <div style={{ height: 5, background: "#F0EDE4", borderRadius: 3, marginTop: 3 }}>
        <div style={{ height: "100%", width: `${Math.max(n > 0 ? 4 : 0, (n / max) * 100)}%`, background: color, borderRadius: 3 }} />
      </div>
    </>
  );
  if (!onClick) return <div style={{ padding: "4px 0" }}>{inner}</div>;
  return (
    <button onClick={onClick} style={{ display: "block", width: "100%", background: "none", border: "none", padding: "4px 0", cursor: "pointer", textAlign: "left" }}>
      {inner}
    </button>
  );
}

/* 記録した日のカレンダー。1マス=1日、濃さ=その日の杯数。
   月別の棒6本より場所を取らずに、4か月ぶんの「飲んだ日」が一度に見える。 */
function Calendar({ list }) {
  const key = (d) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const perDay = {};
  for (const t of list) {
    const k = key(new Date(t.at || Date.now()));
    perDay[k] = (perDay[k] || 0) + 1;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 週の列を日曜はじまりに揃えるため、今週の土曜まで進めてから遡る
  const end = new Date(today.getTime() + (6 - today.getDay()) * DAY_MS);
  const cells = [];
  for (let i = WEEKS * 7 - 1; i >= 0; i--) {
    const d = new Date(end.getTime() - i * DAY_MS);
    cells.push({ d, n: perDay[key(d)] || 0, future: d > today });
  }
  const max = Math.max(1, ...cells.map((c) => c.n));
  // 1杯の日でもはっきり見える濃さから始める（薄すぎると「飲んでいない」に見える）
  const shade = (n) => (n ? `rgba(47, 82, 51, ${(0.35 + (n / max) * 0.65).toFixed(2)})` : "#EFECE3");
  const monthLabel = (w) => {
    const first = cells[w * 7];
    const prev = w > 0 ? cells[(w - 1) * 7] : null;
    return (!prev || first.d.getMonth() !== prev.d.getMonth()) ? `${first.d.getMonth() + 1}月` : "";
  };
  return (
    <div>
      <div style={{ display: "flex", gap: 3 }}>
        {Array.from({ length: WEEKS }, (_, w) => (
          <div key={w} style={{ display: "grid", gridTemplateRows: "repeat(7, 1fr)", gap: 3, flex: 1 }}>
            {Array.from({ length: 7 }, (_, r) => {
              const c = cells[w * 7 + r];
              return (
                <div key={r} title={`${c.d.getMonth() + 1}/${c.d.getDate()}　${c.n}杯`}
                  style={{ aspectRatio: "1", borderRadius: 2, background: c.future ? "transparent" : shade(c.n) }} />
              );
            })}
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 3, marginTop: 4 }}>
        {Array.from({ length: WEEKS }, (_, w) => (
          <div key={w} style={{ flex: 1, fontSize: FS.meta, color: GRAY, whiteSpace: "nowrap" }}>{monthLabel(w)}</div>
        ))}
      </div>
    </div>
  );
}

/* 自分が飲んだ豆を、味わいマップと同じ座標に打つ。
   横=クリーン↔個性派 / 縦=明るい↔深い。★4以上は少し大きく、点の色は系統。
   座標を出せる豆（図鑑にある豆）だけが対象。 */
function scatterPoints(list) {
  const pts = [];
  for (const t of list) {
    const b = BEANS.find((x) => x.id === t.beanId);
    if (!b) continue;
    const m = flavorOf(b);
    if (!m) continue;
    pts.push({ b, t, fx: m.fx, fy: m.fy, fam: m.fam });
  }
  return pts;
}

function FlavorScatter({ pts, onOpen }) {
  const fams = [...new Set(pts.map((p) => p.fam))];
  return (
    <div>
      <div style={{ position: "relative", height: 190, background: "#F7F5EF", borderRadius: 10, border: `1px solid ${LINE}` }}>
        {/* 軸の目安。細く薄く、点より後ろに置く */}
        <div style={{ position: "absolute", left: 0, right: 0, top: "50%", height: 1, background: LINE }} />
        <div style={{ position: "absolute", top: 0, bottom: 0, left: "50%", width: 1, background: LINE }} />
        {pts.map((p, i) => {
          const size = p.t.rating >= 4 ? 11 : 8;
          return (
            <button key={i} onClick={() => onOpen && onOpen(p.b)}
              title={`${p.b.name}${p.t.rating ? `　${"★".repeat(p.t.rating)}` : ""}`}
              style={{
                position: "absolute", left: `${4 + p.fx * 0.92}%`, top: `${4 + p.fy * 0.92}%`,
                width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2,
                borderRadius: 999, background: (FLAVORS[p.fam] || {}).color || GRAY,
                border: `2px solid ${PAPER}`, padding: 0, cursor: "pointer",
              }} />
          );
        })}
        <span style={{ position: "absolute", left: 8, top: 6, fontSize: FS.meta, color: GRAY }}>明るい</span>
        <span style={{ position: "absolute", left: 8, bottom: 6, fontSize: FS.meta, color: GRAY }}>深い</span>
        <span style={{ position: "absolute", right: 8, bottom: 6, fontSize: FS.meta, color: GRAY }}>個性派 →</span>
      </div>
      {/* 系統を色だけで分からせない。凡例を必ず添える */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 7 }}>
        {fams.map((f) => (
          <span key={f} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: FS.meta, color: GRAY }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: (FLAVORS[f] || {}).color || GRAY }} />
            {(FLAVORS[f] || {}).label || f}
          </span>
        ))}
        <span style={{ fontSize: FS.meta, color: GRAY }}>大きい点＝★4以上</span>
      </div>
    </div>
  );
}

export function Portfolio({ list, email, onOpen, onRoaster }) {
  const [tab, setTab] = useState("origin");   // 内訳の切り替え（縦に3つ並べない）
  const pts = scatterPoints(list);            // 味わいマップに打てる記録
  const rated = list.filter((t) => t.rating);
  const beanOf = (t) => BEANS.find((b) => b.id === t.beanId) || null;

  const avg = rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length) : 0;
  const roasterKeys = [...new Set(list.map((t) => t.r).filter((k) => k && ROASTERS[k]))];
  const origins = {}, groups = {}, procs = {}, byRoaster = {};
  const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let spend = 0, priced = 0;

  for (const t of list) {
    const b = beanOf(t);
    const origin = t.origin || (b && b.origin) || "";
    if (origin) origins[origin] = (origins[origin] || 0) + 1;
    const g = ORIGIN_GROUP(origin);
    if (g) groups[g] = (groups[g] || 0) + 1;
    if (b) {
      const pk = processKey(b.process);
      procs[pk] = (procs[pk] || 0) + 1;
      spend += toJPY(b);
      priced++;
    }
    if (t.rating) stars[t.rating] = (stars[t.rating] || 0) + 1;
    if (t.r && ROASTERS[t.r]) byRoaster[t.r] = (byRoaster[t.r] || 0) + 1;
  }

  const topRoasters = Object.entries(byRoaster).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const topOrigins = Object.entries(origins).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const procList = Object.entries(procs).sort((a, b) => b[1] - a[1]);
  const favs = rated.filter((t) => t.rating >= 4).sort((a, b) => b.rating - a.rating || b.at - a.at).slice(0, 5);

  const tiles = [
    ["杯", list.length],
    ["平均", rated.length ? avg.toFixed(1) : "–"],
    ["店", roasterKeys.length],
    ["産地", Object.keys(origins).length],
  ];

  if (list.length === 0) {
    return (
      <div style={{ marginTop: 14, padding: "20px 18px", border: `1px dashed ${LINE}`, borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: FS.body, fontWeight: 700 }}>ポートフォリオはまだ空です</div>
        <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 6, lineHeight: 1.8 }}>
          図鑑で豆を開いて「☕ 飲んだ味を記録」から追加するか、<br />
          下の「＋ 過去に飲んだ豆を記録」でこれまでの一杯を入れてください。
        </div>
      </div>
    );
  }

  const TABS = [
    ["origin", "産地", topOrigins.length],
    ["proc", "精製", procList.length],
    ["star", "評価", rated.length],
  ].filter(([, , n]) => n > 0);

  return (
    <div>
      {/* 見出し。数字は1行に畳む */}
      <div style={{ marginTop: 14, padding: "13px 15px", background: "#141210", color: PAPER, borderRadius: 12 }}>
        <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 8 }}>
          <span style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.meta, letterSpacing: "0.18em", color: "#B8AE9E" }}>PORTFOLIO</span>
          {email && <span style={{ fontSize: FS.meta, color: "#B8AE9E", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", minWidth: 0 }}>{email}</span>}
        </div>
        <div style={{ display: "flex", gap: 16, marginTop: 9 }}>
          {tiles.map(([k, v]) => (
            <div key={k}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.head, fontWeight: 800, lineHeight: 1.1 }}>{v}</div>
              <div style={{ fontSize: FS.meta, color: "#B8AE9E", marginTop: 2 }}>{k}</div>
            </div>
          ))}
          {priced > 0 && (
            <div style={{ marginLeft: "auto", textAlign: "right" }}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: FS.head, fontWeight: 800, lineHeight: 1.1 }}>¥{Math.round(spend).toLocaleString()}</div>
              <div style={{ fontSize: FS.meta, color: "#B8AE9E", marginTop: 2 }}>豆代（{priced}件）</div>
            </div>
          )}
        </div>
      </div>

      <Section title="飲んだ日" sub={`直近${Math.round(WEEKS / 4.35)}か月`}>
        <Calendar list={list} />
      </Section>

      {pts.length >= 2 && (
        <Section title="あなたの味わい" sub={`図鑑にある${pts.length}杯・タップで詳細`}>
          <FlavorScatter pts={pts} onOpen={onOpen} />
        </Section>
      )}

      {TABS.length > 0 && (
        <Section title="内訳"
          right={
            <div style={{ display: "flex", gap: 4 }}>
              {TABS.map(([k, l]) => (
                <button key={k} onClick={() => setTab(k)}
                  style={{ padding: "3px 9px", borderRadius: 999, border: `1px solid ${tab === k ? INK : LINE}`,
                    background: tab === k ? INK : PAPER, color: tab === k ? PAPER : GRAY, fontSize: FS.meta, cursor: "pointer" }}>
                  {l}
                </button>
              ))}
            </div>
          }>
          {tab === "origin" && (
            <>
              {Object.keys(groups).length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                  {Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([g, n]) => (
                    <span key={g} style={{ fontSize: FS.meta, color: PAPER, background: GREEN, borderRadius: 999, padding: "3px 10px" }}>
                      {GROUP_LABEL[g] || g} {n}
                    </span>
                  ))}
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12 }}>
                {topOrigins.map(([o, n]) => <Bar key={o} label={o} n={n} max={topOrigins[0][1]} color={GREEN} />)}
              </div>
            </>
          )}
          {tab === "proc" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12 }}>
              {procList.map(([k, n]) => (
                <Bar key={k} label={(PROC[k] || PROC.other).label} n={n} max={procList[0][1]} color={(PROC[k] || PROC.other).bg} />
              ))}
            </div>
          )}
          {tab === "star" && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", columnGap: 12 }}>
              {[5, 4, 3, 2, 1].map((s) => (
                <Bar key={s} label={"★".repeat(s)} n={stars[s] || 0} max={Math.max(1, ...Object.values(stars))} color="#E4A11B" />
              ))}
            </div>
          )}
        </Section>
      )}

      {topRoasters.length > 0 && (
        <Section title="よく飲むロースター" sub="タップでページへ">
          {topRoasters.map(([k, n]) => (
            <Bar key={k} label={ROASTERS[k].name} n={n} max={topRoasters[0][1]} color={INK} onClick={() => onRoaster(k)} />
          ))}
        </Section>
      )}

      {favs.length > 0 && (
        <Section title="お気に入り" sub="★4以上">
          {favs.map((t) => {
            const b = beanOf(t);
            const r = b && ROASTERS[b.r];
            const buyable = b && b.status === "now" && r && r.url;
            return (
              <div key={t.beanId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "7px 0", borderBottom: `1px solid ${LINE}` }}>
                <button onClick={() => b && onOpen(b)} disabled={!b}
                  style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: b ? "pointer" : "default" }}>
                  <div style={{ fontSize: FS.body, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 2 }}>
                    <span style={{ color: "#E4A11B" }}>{"★".repeat(t.rating)}</span>
                    {t.roaster ? ` ・ ${t.roaster}` : ""}{t.origin ? ` ・ ${t.origin}` : ""}
                  </div>
                </button>
                {buyable && (
                  <a href={beanHref(r, b)} target="_blank" rel="noopener noreferrer"
                    style={{ flexShrink: 0, textDecoration: "none", padding: "5px 11px", background: INK, color: PAPER, borderRadius: 6, fontSize: FS.meta, fontWeight: 700, whiteSpace: "nowrap" }}>
                    また買う ↗
                  </a>
                )}
              </div>
            );
          })}
        </Section>
      )}
    </div>
  );
}
