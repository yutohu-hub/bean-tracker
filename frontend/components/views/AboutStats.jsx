"use client";
// About の「いま図鑑に何が入っているか」を、数字と図で見せる。
//
// 文章で「世界中のロースターを追いかけています」と書くより、実際の内訳を
// 出したほうが早い。数字は全て、いま配信しているデータから数えている
// （手で書いた値は1つも無いので、巡回が進めば自動で変わる）。
//
// 色は図鑑のカードと同じ精製色をそのまま使う。About で色の意味を覚えてもらい、
// 図鑑でその色を見て思い出す、という順番にしたい。
// ただし Anaerobic Natural と Anaerobic Washed は色だけでは見分けにくいため、
// どの棒にも必ず名前と件数を添えて、色だけに意味を持たせない。

import { useMemo } from "react";
import { INK, PAPER, GRAY, LINE } from "../lib/theme";
import { PROC, processKey, per100JPY } from "../lib/palette";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";

const REGION_JA = {
  nordic: "北欧", uk: "英国・アイルランド", europe: "ヨーロッパ",
  northAmerica: "北米", latinAmerica: "中南米", oceania: "オセアニア",
  eastAsia: "東アジア", seAsiaIndia: "東南アジア・インド", africaMideast: "アフリカ・中東",
};

const PROC_ORDER = ["washed", "natural", "honey", "anatural", "awashed", "other"];

// 100gあたりの価格帯。図鑑の色分け（¥3,000〜 / ¥5,000〜）と境目を合わせる
const BANDS = [
  { label: "〜¥1,000", test: (p) => p < 1000 },
  { label: "¥1,000〜2,000", test: (p) => p >= 1000 && p < 2000 },
  { label: "¥2,000〜3,000", test: (p) => p >= 2000 && p < 3000 },
  { label: "¥3,000〜5,000", test: (p) => p >= 3000 && p < 5000 },
  { label: "¥5,000〜", test: (p) => p >= 5000 },
];

function Stat({ n, unit, label }) {
  return (
    /* boxSizing を入れないと、内側の余白のぶんだけ幅が 50% を超えて1列に落ちる */
    <div style={{ flex: "1 1 44%", minWidth: 130, boxSizing: "border-box", padding: "14px 16px", background: "#F7F5EF", borderRadius: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
        <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 26, fontWeight: 800, color: INK, letterSpacing: "-0.02em" }}>
          {n.toLocaleString()}
        </span>
        <span style={{ fontSize: 11, color: GRAY }}>{unit}</span>
      </div>
      <div style={{ fontSize: 11, color: GRAY, marginTop: 4, lineHeight: 1.5 }}>{label}</div>
    </div>
  );
}

/* 横棒1本。値は必ず棒の外に文字で出す（色や長さだけに頼らない）。
   棒の先端だけ丸めるのは、0が「短い棒」ではなく「無い」と読めるようにするため。 */
function Bar({ label, n, max, color, sub }) {
  const w = max > 0 ? Math.max(n > 0 ? 2 : 0, (n / max) * 100) : 0;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "5px 0" }}>
      <div style={{ width: 116, flexShrink: 0, fontSize: 11.5, color: INK, lineHeight: 1.4 }}>
        {label}
        {sub && <div style={{ fontSize: 9.5, color: GRAY }}>{sub}</div>}
      </div>
      <div style={{ flex: 1, minWidth: 0, height: 10, background: "#EFECE3", borderRadius: 5 }}>
        <div style={{ width: `${w}%`, height: "100%", background: color, borderRadius: 5 }} />
      </div>
      <div style={{ width: 46, flexShrink: 0, textAlign: "right", fontFamily: "ui-monospace, monospace", fontSize: 11, color: GRAY }}>
        {n.toLocaleString()}
      </div>
    </div>
  );
}

function Section({ title, note, children }) {
  return (
    <div style={{ marginTop: 20 }}>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: INK }}>{title}</div>
      {note && <div style={{ fontSize: 10.5, color: GRAY, marginTop: 3, lineHeight: 1.7 }}>{note}</div>}
      <div style={{ marginTop: 8 }}>{children}</div>
    </div>
  );
}

export function AboutStats() {
  const s = useMemo(() => {
    const shops = Object.values(ROASTERS).filter((r) => r.url);
    const now = BEANS.filter((b) => b.status === "now" && ROASTERS[b.r] && ROASTERS[b.r].url);

    const byRegion = {};
    for (const r of shops) {
      const key = REGION_JA[r.region] ? r.region : "europe";
      byRegion[key] = (byRegion[key] || 0) + 1;
    }

    const byProc = {};
    for (const b of now) {
      const k = processKey(b.process);
      byProc[k] = (byProc[k] || 0) + 1;
    }

    // 値段が取れていない豆（0円）は価格の分布から外す。0円の山ができてしまう
    const priced = now.filter((b) => b.amount > 0);
    const bands = BANDS.map((band) => ({ label: band.label, n: priced.filter((b) => band.test(per100JPY(b))).length }));

    return {
      shops: shops.length,
      countries: new Set(shops.map((r) => r.country)).size,
      now: now.length,
      origins: new Set(now.map((b) => b.origin).filter((o) => o && o !== "ブレンド")).size,
      notes: now.filter((b) => b.notes).length,
      regions: Object.entries(byRegion).sort((a, b) => b[1] - a[1]),
      procs: PROC_ORDER.map((k) => ({ k, n: byProc[k] || 0 })).filter((x) => x.n > 0),
      bands,
      priced: priced.length,
    };
  }, []);

  const maxRegion = Math.max(...s.regions.map(([, n]) => n), 1);
  const maxProc = Math.max(...s.procs.map((p) => p.n), 1);
  const maxBand = Math.max(...s.bands.map((b) => b.n), 1);
  const notePct = s.now ? Math.round((s.notes / s.now) * 100) : 0;

  return (
    <div style={{ marginTop: 26, padding: "20px 20px 22px", border: `1px solid ${LINE}`, borderRadius: 14, background: PAPER }}>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.2em", color: GRAY }}>NOW IN THE BOOK</div>
      <div style={{ fontSize: 16, fontWeight: 800, marginTop: 6 }}>いま、図鑑に入っているもの</div>
      <div style={{ fontSize: 11.5, color: GRAY, marginTop: 5, lineHeight: 1.8 }}>
        下の数字はすべて、いま配信しているデータを数えたものです。巡回が進むと自動で変わります。
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 14 }}>
        <Stat n={s.shops} unit="軒" label="追いかけているロースター" />
        <Stat n={s.countries} unit="の国と地域" label="ロースターの所在地" />
        <Stat n={s.now} unit="銘柄" label="いま買える豆" />
        <Stat n={s.origins} unit="の産地" label="いま買える豆の産地" />
      </div>

      <Section title="どこのロースターを見ているか" note="地域別の軒数">
        {s.regions.map(([k, n]) => (
          <Bar key={k} label={REGION_JA[k]} n={n} max={maxRegion} color={INK} />
        ))}
      </Section>

      <Section title="精製方法の内訳"
        note="図鑑のカードは、この色で塗り分けています。色を覚えると、一覧を見るだけで味の方向性の当たりがつきます。">
        {s.procs.map(({ k, n }) => (
          <Bar key={k} label={PROC[k].label} n={n} max={maxProc} color={PROC[k].bg} />
        ))}
      </Section>

      <Section title="100gあたりの価格帯" note={`値段が取れている ${s.priced.toLocaleString()}銘柄の分布（円換算）`}>
        {s.bands.map((b) => (
          <Bar key={b.label} label={b.label} n={b.n} max={maxBand} color={INK} />
        ))}
      </Section>

      <div style={{ marginTop: 18, paddingTop: 14, borderTop: `1px solid ${LINE}`, fontSize: 11.5, color: GRAY, lineHeight: 1.9 }}>
        いま買える {s.now.toLocaleString()}銘柄のうち、<strong style={{ color: INK }}>{s.notes.toLocaleString()}銘柄（{notePct}%）</strong>には
        ロースター自身が書いたフレーバーノートが付いています。味わいマップは、この文章を読んで座標を決めています。
      </div>
    </div>
  );
}
