"use client";
/* 記録を紙（＝PDF）の形にまとめる。
 *
 * ■ なぜ jsPDF ではなく印刷なのか
 *
 * jsPDF などで PDF を組み立てると、日本語を出すのに CJK フォントを同梱する
 * 必要がある。文字数が多いので、削っても数MBになる。図鑑そのものが 700KB 台の
 * 静的サイトなので、記録の書き出しのためにその何倍もを全員に配るのは割に合わない。
 *
 * ブラウザの印刷はどの端末にも入っていて、iOS でも Android でも PC でも
 * 「PDFとして保存」が選べる。文字は端末のフォントで組まれるので日本語も崩れない。
 * 追加のライブラリは0バイト。
 *
 * ■ 画面には出さない
 *
 * 印刷のときだけ現れる。globals（layout.jsx）の @media print で、
 * 画面用の中身を隠してこちらだけを出している。
 */
import { useState, useEffect } from "react";
import { BEANS } from "../data/beans";
import { ORIGIN_GROUP, GROUP_LABEL } from "../lib/originGroup";

const d2 = (n) => String(n).padStart(2, "0");
const ymd = (t) => { const d = new Date(t || Date.now()); return `${d.getFullYear()}.${d2(d.getMonth() + 1)}.${d2(d.getDate())}`; };
const stars = (n) => "★".repeat(Math.max(0, Math.round(n || 0))) + "☆".repeat(Math.max(0, 5 - Math.round(n || 0)));

/* 記録から、その豆の精製方法を引く。記録は豆のIDを持っているので図鑑から辿れる。
   図鑑から消えた豆（手で足した記録）は分からないので「不明」にまとめる。 */
const procOf = (t) => {
  const b = BEANS.find((x) => x.id === t.beanId);
  return (b && b.process) || "不明";
};

// 数えて多い順。同数なら名前順で、開くたびに並びが変わらないようにする
function tally(list, key) {
  const c = new Map();
  for (const t of list) {
    const k = key(t) || "不明";
    c.set(k, (c.get(k) || 0) + 1);
  }
  return [...c.entries()].sort((a, b) => b[1] - a[1] || String(a[0]).localeCompare(String(b[0], "ja")));
}

const avg = (list) => {
  const r = list.map((t) => Number(t.rating) || 0).filter(Boolean);
  return r.length ? (r.reduce((a, b) => a + b, 0) / r.length) : 0;
};

function Bar({ rows, total }) {
  return (
    <table className="bt-p-table">
      <tbody>
        {rows.map(([label, n]) => (
          <tr key={label}>
            <td className="bt-p-name">{label}</td>
            <td className="bt-p-num">{n}</td>
            <td className="bt-p-bar">
              <span style={{ display: "inline-block", height: 7, width: `${Math.round((n / total) * 100)}%`, background: "#17150F" }} />
            </td>
            <td className="bt-p-pct">{Math.round((n / total) * 100)}%</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Section({ title, note, children }) {
  return (
    <section className="bt-p-sec">
      <h2 className="bt-p-h2">{title}</h2>
      {note && <p className="bt-p-note">{note}</p>}
      {children}
    </section>
  );
}

export function PrintSheet({ list, email }) {
  /* 端末に置いてある記録から作るので、静的に書き出したHTMLとは中身が食い違う。
     そのまま出すと React が組み直しに失敗する（#425）。
     画面に出るものではないので、端末側で組み上がってから描けばいい。 */
  const [ready, setReady] = useState(false);
  useEffect(() => { setReady(true); }, []);

  const total = list.length;
  if (!ready || !total) return <div id="bt-print" aria-hidden />;

  const sorted = [...list].sort((a, b) => (b.at || 0) - (a.at || 0));
  const first = sorted[sorted.length - 1], last = sorted[0];
  const rated = list.filter((t) => Number(t.rating) > 0);

  const byGroup = tally(list, (t) => { const g = ORIGIN_GROUP(t.origin || ""); return g ? GROUP_LABEL[g] : "その他・ブレンド"; });
  const byOrigin = tally(list, (t) => t.origin);
  const byProc = tally(list, procOf);
  const byRoaster = tally(list, (t) => t.roaster);
  const byRating = [5, 4, 3, 2, 1].map((n) => [`${stars(n)}`, rated.filter((t) => Math.round(t.rating) === n).length]).filter(([, n]) => n);

  return (
    <div id="bt-print">
      <header className="bt-p-head">
        <div className="bt-p-brand">BEAN TRACKER</div>
        <h1 className="bt-p-h1">コーヒーの記録</h1>
        <div className="bt-p-meta">
          {email ? `${email} ・ ` : ""}{ymd(first && first.at)} 〜 {ymd(last && last.at)} ・ {ymd(Date.now())} 書き出し
        </div>
      </header>

      <section className="bt-p-sum">
        <div><span className="bt-p-big">{total}</span><span className="bt-p-unit">杯の記録</span></div>
        <div><span className="bt-p-big">{byRoaster.length}</span><span className="bt-p-unit">の焙煎所</span></div>
        <div><span className="bt-p-big">{byOrigin.length}</span><span className="bt-p-unit">の産地</span></div>
        <div><span className="bt-p-big">{rated.length ? avg(list).toFixed(1) : "—"}</span><span className="bt-p-unit">平均評価</span></div>
      </section>

      <Section title="産地の大きな括り">
        <Bar rows={byGroup} total={total} />
      </Section>

      <Section title="産地" note={`${byOrigin.length} か所`}>
        <Bar rows={byOrigin} total={total} />
      </Section>

      <Section title="精製方法" note="図鑑にある豆から引いています。手で足した記録は「不明」にまとめています。">
        <Bar rows={byProc} total={total} />
      </Section>

      <Section title="焙煎所" note={`${byRoaster.length} 軒`}>
        <Bar rows={byRoaster} total={total} />
      </Section>

      {byRating.length > 0 && (
        <Section title="評価" note={`${rated.length} 件に評価あり`}>
          <Bar rows={byRating} total={rated.length} />
        </Section>
      )}

      <Section title="すべての記録" note={`${total} 件・新しい順`}>
        <table className="bt-p-table bt-p-list">
          <thead>
            <tr><th>日付</th><th>豆</th><th>焙煎所</th><th>産地</th><th>評価</th></tr>
          </thead>
          <tbody>
            {sorted.map((t) => (
              <tr key={`${t.beanId}-${t.at}`}>
                <td className="bt-p-date">{ymd(t.at)}</td>
                <td>{t.name}{t.note ? <div className="bt-p-memo">{t.note}</div> : null}</td>
                <td>{t.roaster || "—"}</td>
                <td>{t.origin || "—"}</td>
                <td className="bt-p-star">{t.rating ? stars(t.rating) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Section>

      <footer className="bt-p-foot">BEAN TRACKER — 評価はあなたのためだけのものです。この記録は端末内に保存されています。</footer>
    </div>
  );
}
