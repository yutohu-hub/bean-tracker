"use client";
import { INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";
import { toJPY } from "../lib/currency";
import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { ORIGIN_GROUP, GROUP_LABEL } from "../lib/analysis";
import { PROC, processKey } from "../lib/palette";
import { beanHref } from "../lib/utils";

const MONTH = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];

function Section({ title, sub, children }) {
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 800 }}>{title}</span>
        {sub && <span style={{ fontSize: 10, color: GRAY }}>{sub}</span>}
      </div>
      <div style={{ borderTop: `1px solid ${LINE}`, marginTop: 6, paddingTop: 10 }}>{children}</div>
    </div>
  );
}

/* 横棒。max に対する比で幅を決める。onClick があれば押せる行になる */
function Bar({ label, n, max, color = INK, onClick, suffix = "" }) {
  const inner = (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <span style={{ fontSize: 12, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, color: GRAY, flexShrink: 0 }}>{n}{suffix}</span>
      </div>
      <div style={{ height: 6, background: "#F0EDE4", borderRadius: 3, marginTop: 4, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.max(4, (n / max) * 100)}%`, background: color, borderRadius: 3 }} />
      </div>
    </>
  );
  if (!onClick) return <div style={{ padding: "6px 0" }}>{inner}</div>;
  return (
    <button onClick={onClick}
      style={{ display: "block", width: "100%", background: "none", border: "none", padding: "6px 0", cursor: "pointer", textAlign: "left" }}>
      {inner}
    </button>
  );
}

/* 記録（tastings）だけを材料に、その人の一年の飲み方を組み立てる。
   図鑑に無い手入力の記録（beanId が負）も件数・評価・産地には効くようにしている。 */
export function Portfolio({ list, email, onOpen, onRoaster }) {
  const rated = list.filter((t) => t.rating);
  const beanOf = (t) => BEANS.find((b) => b.id === t.beanId) || null;

  const avg = rated.length ? (rated.reduce((s, t) => s + t.rating, 0) / rated.length) : 0;
  const roasterKeys = [...new Set(list.map((t) => t.r).filter((k) => k && ROASTERS[k]))];
  const origins = {};
  const groups = {};
  const procs = {};
  const stars = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const byRoaster = {};
  const months = {};
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
    const d = new Date(t.at || Date.now());
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    months[key] = (months[key] || 0) + 1;
  }

  const topRoasters = Object.entries(byRoaster).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const topOrigins = Object.entries(origins).sort((a, b) => b[1] - a[1]).slice(0, 8);
  const procList = Object.entries(procs).sort((a, b) => b[1] - a[1]);
  const favs = rated.filter((t) => t.rating >= 4).sort((a, b) => b.rating - a.rating || b.at - a.at).slice(0, 6);

  // 直近6か月の記録数（記録が無い月も並べて増減が見えるように）
  const now = new Date();
  const timeline = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    timeline.push({ label: MONTH[d.getMonth()], n: months[`${d.getFullYear()}-${d.getMonth()}`] || 0 });
  }
  const tlMax = Math.max(1, ...timeline.map((x) => x.n));

  const tiles = [
    ["記録した杯", list.length],
    ["平均評価", rated.length ? avg.toFixed(1) : "–"],
    ["ロースター", roasterKeys.length],
    ["産地", Object.keys(origins).length],
  ];

  if (list.length === 0) {
    return (
      <div style={{ marginTop: 16, padding: "22px 18px", border: `1px dashed ${LINE}`, borderRadius: 12, textAlign: "center" }}>
        <div style={{ fontSize: 13, fontWeight: 700 }}>ポートフォリオはまだ空です</div>
        <div style={{ fontSize: 11.5, color: GRAY, marginTop: 6, lineHeight: 1.8 }}>
          図鑑で豆を開いて「☕ 飲んだ味を記録」から追加するか、<br />
          下の「＋ 過去に飲んだ豆を記録」でこれまでの一杯を入れてください。<br />
          記録が増えるほど、好みの傾向がここに出てきます。
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 見出し */}
      <div style={{ marginTop: 16, padding: "16px 16px 14px", background: "#141210", color: PAPER, borderRadius: 14 }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.18em", color: "#B8AE9E" }}>PORTFOLIO</div>
        {email && <div style={{ fontSize: 11.5, color: "#B8AE9E", marginTop: 3, wordBreak: "break-all" }}>{email}</div>}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 18, marginTop: 12 }}>
          {tiles.map(([k, v]) => (
            <div key={k}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 21, fontWeight: 800 }}>{v}</div>
              <div style={{ fontSize: 9.5, color: "#B8AE9E", marginTop: 1 }}>{k}</div>
            </div>
          ))}
        </div>
        {priced > 0 && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.14)", fontSize: 11, color: "#B8AE9E", lineHeight: 1.7 }}>
            図鑑の価格で換算すると、この記録は
            <span style={{ color: PAPER, fontWeight: 700, fontFamily: "ui-monospace, monospace" }}> ¥{Math.round(spend).toLocaleString()}</span>
            ぶんの豆です（{priced}件ぶん・1袋あたりの価格で計算）
          </div>
        )}
      </div>

      {/* 味の傾向 */}
      {Object.keys(groups).length > 0 && (
        <Section title="産地の傾向" sub="記録した豆の産地グループ">
          {Object.entries(groups).sort((a, b) => b[1] - a[1]).map(([g, n]) => (
            <Bar key={g} label={GROUP_LABEL[g] || g} n={n} suffix="杯"
              max={Math.max(...Object.values(groups))} color={GREEN} />
          ))}
        </Section>
      )}

      {/* 精製方法 */}
      {procList.length > 0 && (
        <Section title="精製方法の傾向" sub="図鑑に載っている豆から集計">
          {procList.map(([k, n]) => (
            <Bar key={k} label={(PROC[k] || PROC.other).label} n={n} suffix="杯"
              max={procList[0][1]} color={(PROC[k] || PROC.other).bg} />
          ))}
        </Section>
      )}

      {/* 評価の分布 */}
      {rated.length > 0 && (
        <Section title="評価の分布" sub={`${rated.length}件`}>
          {[5, 4, 3, 2, 1].map((s) => (
            <Bar key={s} label={"★".repeat(s)} n={stars[s] || 0} suffix="杯"
              max={Math.max(1, ...Object.values(stars))} color="#E4A11B" />
          ))}
        </Section>
      )}

      {/* よく飲むロースター */}
      {topRoasters.length > 0 && (
        <Section title="よく飲むロースター" sub="タップでロースターのページへ">
          {topRoasters.map(([k, n]) => (
            <Bar key={k} label={ROASTERS[k].name} n={n} suffix="杯"
              max={topRoasters[0][1]} color={INK} onClick={() => onRoaster(k)} />
          ))}
        </Section>
      )}

      {/* 産地 */}
      {topOrigins.length > 0 && (
        <Section title="産地" sub={`${Object.keys(origins).length}か国・地域`}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {topOrigins.map(([o, n]) => (
              <span key={o} style={{ fontSize: 11.5, color: INK, background: "#F2F0E9", borderRadius: 999, padding: "5px 11px" }}>
                {o} <span style={{ fontFamily: "ui-monospace, monospace", color: GRAY }}>{n}</span>
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* 記録の推移 */}
      <Section title="記録の推移" sub="直近6か月">
        <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 84 }}>
          {timeline.map((m, i) => (
            <div key={i} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: m.n ? INK : LINE }}>{m.n || ""}</div>
              <div style={{ height: `${(m.n / tlMax) * 52}px`, minHeight: m.n ? 4 : 2,
                background: m.n ? GREEN : "#EDEAE1", borderRadius: 3, marginTop: 3 }} />
              <div style={{ fontSize: 9.5, color: GRAY, marginTop: 4 }}>{m.label}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* お気に入り */}
      {favs.length > 0 && (
        <Section title="お気に入り" sub="★4以上">
          {favs.map((t) => {
            const b = beanOf(t);
            const r = b && ROASTERS[b.r];
            const buyable = b && b.status === "now" && r && r.url;
            return (
              <div key={t.beanId} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${LINE}` }}>
                <button onClick={() => b && onOpen(b)} disabled={!b}
                  style={{ flex: 1, minWidth: 0, background: "none", border: "none", padding: 0, textAlign: "left", cursor: b ? "pointer" : "default" }}>
                  <div style={{ fontSize: 12.5, fontWeight: 700, color: INK, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{t.name}</div>
                  <div style={{ fontSize: 10, color: GRAY, marginTop: 2 }}>
                    <span style={{ color: "#E4A11B" }}>{"★".repeat(t.rating)}</span>
                    {t.roaster ? ` ・ ${t.roaster}` : ""}{t.origin ? ` ・ ${t.origin}` : ""}
                  </div>
                </button>
                {buyable && (
                  <a href={beanHref(r, b)} target="_blank" rel="noopener noreferrer"
                    style={{ flexShrink: 0, textDecoration: "none", padding: "6px 12px", background: INK, color: PAPER, borderRadius: 6, fontSize: 10.5, fontWeight: 700, whiteSpace: "nowrap" }}>
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
