"use client";
import { useState, useMemo, useEffect } from "react";
import { INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";

/* ============================================================
   好み診断 v2 — 全ロースターをメタデータでスコアリングして推薦。
   回答は localStorage に蓄積し、次回以降の推薦に反映（学習機能）。
   ============================================================ */

const LS_KEY = "bt_diag_profile_v2";

// ロースターの特徴量（style / focus / region / ship から算出、1回だけ）
function featureOf(r) {
  const s = r.style || "", f = r.focus || "", reg = r.region || "";
  const light = /極浅/.test(s) ? 1 : /浅煎り/.test(s) ? (/中/.test(s) ? 0.7 : 0.9) : /中深|深/.test(s) ? 0 : 0.4;
  const medium = /中浅|中煎り/.test(s) ? 1 : /浅〜中|浅\/中/.test(s) ? 0.7 : 0.4;
  const africa = /エチオピア|ケニア|ルワンダ/.test(f) || reg === "africaMideast" ? 1 : 0;
  const latam = /コロンビア|ブラジル|グアテマラ|コスタリカ|メキシコ|ペルー|パナマ/.test(f) || reg === "latinAmerica" ? 1 : 0;
  const asia = reg === "eastAsia" || reg === "seAsiaIndia" ? 1 : 0;
  const geisha = /ゲイシャ|希少/.test(f) ? 1 : 0;
  const experimental = geisha ? 1 : /実験|アナエロビック|anaerobic/i.test(s + f) ? 1 : 0;
  const domestic = /国内/.test(r.ship || "") ? 1 : 0;
  return { light, medium, africa, latam, asia, geisha, experimental, domestic, natural: geisha ? 0.6 : 0.4, clean: 0.6 };
}

const QUESTIONS = [
  { q: "焙煎度の好みは?", options: [
    { label: "浅煎り一筋", w: { light: 2 } },
    { label: "浅〜中浅で幅広く", w: { medium: 2 } },
    { label: "おまかせで楽しみたい", w: {} },
  ]},
  { q: "どんな味わいが好きですか?", options: [
    { label: "すっきり明るい酸味", w: { light: 1, africa: 1.5, clean: 0.5 } },
    { label: "フルーティで甘やか", w: { africa: 0.8, latam: 0.5, natural: 1.2 } },
    { label: "バランスよく飲みやすい", w: { latam: 1.5, medium: 1 } },
    { label: "未知の味に出会いたい", w: { geisha: 2, experimental: 1 } },
  ]},
  { q: "惹かれる産地は?", options: [
    { label: "アフリカ系（エチオピア・ケニア）", w: { africa: 2 } },
    { label: "中南米系（コロンビア・ブラジル）", w: { latam: 2 } },
    { label: "アジア・日本の生産地", w: { asia: 2, domestic: 1 } },
    { label: "こだわらず世界中から", w: {} },
  ]},
  { q: "精製方式への冒険度は?", options: [
    { label: "クリーンな Washed が基本", w: { clean: 1.5 } },
    { label: "Natural や Honey も好き", w: { natural: 1.5 } },
    { label: "Anaerobic など実験系も試したい", w: { experimental: 1.5, geisha: 0.8 } },
  ]},
  { q: "豆の買い方は?", options: [
    { label: "国内でさっと届いてほしい", w: { domestic: 2.5 } },
    { label: "海外からの取り寄せも楽しい", w: {} },
  ]},
];

const TYPE_OF = {
  light: "クリーン浅煎り型", africa: "アフリカ果実型", latam: "中南米バランス型",
  geisha: "レアロット探究型", experimental: "実験精製型", domestic: "国内デイリー型",
  asia: "アジア開拓型", medium: "オールラウンド型",
};

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || { attr: {}, aff: {}, runs: 0 }; }
  catch { return { attr: {}, aff: {}, runs: 0 }; }
}
function saveProfile(p) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {} }

export function DiagnosisView({ onRoaster }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [profile, setProfile] = useState({ attr: {}, aff: {}, runs: 0 });

  // 特徴量とライブ在庫（now がある店だけ推薦対象に）は1回だけ計算
  const { feats, liveKeys } = useMemo(() => {
    const feats = {}; for (const [k, r] of Object.entries(ROASTERS)) feats[k] = featureOf(r);
    const liveKeys = new Set(BEANS.filter((b) => b.status === "now").map((b) => b.r));
    return { feats, liveKeys };
  }, []);

  useEffect(() => { setProfile(loadProfile()); }, []);

  const answer = (w) => { setAnswers([...answers, w]); setStep(step + 1); };
  const reset = () => { setStep(0); setAnswers([]); };
  const resetLearning = () => { const p = { attr: {}, aff: {}, runs: 0 }; saveProfile(p); setProfile(p); };

  // 回答が出そろったらスコア計算・学習保存
  const result = useMemo(() => {
    if (step < QUESTIONS.length) return null;
    // 今回の回答を特徴量重みに集約
    const aw = {};
    for (const w of answers) for (const [f, v] of Object.entries(w)) aw[f] = (aw[f] || 0) + v;
    // 学習プロフィールを混ぜる（過去の好みを alpha 分だけ反映）
    const alpha = 0.5;
    const blended = { ...aw };
    for (const [f, v] of Object.entries(profile.attr)) blended[f] = (blended[f] || 0) + v * alpha;

    const scored = Object.keys(ROASTERS)
      .filter((k) => liveKeys.has(k)) // いま買える店のみ
      .map((k) => {
        const rf = feats[k];
        let s = 0;
        for (const [f, v] of Object.entries(blended)) s += v * (rf[f] || 0);
        s += (profile.aff[k] || 0) * 0.8; // 過去にクリックした店を後押し
        return [k, s];
      })
      .sort((a, b) => b[1] - a[1]);

    const topFeature = Object.entries(aw).sort((a, b) => b[1] - a[1])[0]?.[0] || "medium";
    return { list: scored.slice(0, 5).map((x) => x[0]), type: TYPE_OF[topFeature] || "オールラウンド型", aw };
  }, [step, answers, profile, feats, liveKeys]);

  // 結果が出た瞬間に学習（今回の好みを蓄積）— 1度だけ
  useEffect(() => {
    if (!result) return;
    const p = loadProfile();
    for (const [f, v] of Object.entries(result.aw)) p.attr[f] = Math.min(20, (p.attr[f] || 0) + v * 0.6);
    p.runs = (p.runs || 0) + 1;
    saveProfile(p); setProfile(p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result && result.list.join(",")]);

  const pickRoaster = (k) => {
    const p = loadProfile();
    p.aff[k] = (p.aff[k] || 0) + 3; saveProfile(p); setProfile(p); // クリックは強い好みシグナル
    onRoaster(k);
  };

  const learnBadge = profile.runs > 0
    ? <span style={{ fontSize: 10, color: GREEN, fontWeight: 700 }}>🧠 学習中 · {profile.runs}回分の好みを反映</span>
    : <span style={{ fontSize: 10, color: GRAY }}>🧠 診断するほどおすすめが賢くなります</span>;

  // ---- 結果画面 ----
  if (result) {
    const beansOf = (k) => BEANS.filter((b) => b.r === k && b.status === "now").length;
    return (
      <div className="bt-card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, letterSpacing: "0.1em" }}>RESULT</div>
          {learnBadge}
        </div>
        <div style={{ fontSize: 21, fontWeight: 800, marginTop: 6 }}>{result.type}</div>
        <div style={{ fontSize: 12.5, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>
          あなたの回答と、これまでの好みの学習をもとに、<b>いま買える</b>ロースターを相性順に選びました。
        </div>

        <div style={{ borderTop: `2px solid ${INK}`, marginTop: 16, paddingTop: 12 }}>
          {result.list.map((k, i) => {
            const r = ROASTERS[k];
            return (
              <button key={k} onClick={() => pickRoaster(k)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: i === 0 ? "#F2F0E9" : "none", border: "none", borderRadius: i === 0 ? 8 : 0, borderTop: i === 0 ? "none" : `1px solid ${LINE}`, padding: i === 0 ? "12px" : "11px 2px", cursor: "pointer", textAlign: "left", marginTop: i === 0 ? 0 : 0 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    {i === 0 && <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: GREEN, fontWeight: 700 }}>BEST MATCH</span>}
                    <span style={{ fontSize: i === 0 ? 16 : 13, fontWeight: 700, color: INK }}>{r.name}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: GRAY, marginTop: 2 }}>{r.city} / {r.country} ・ {r.focus}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GREEN }}>NOW {beansOf(k)}</div>
                  <div style={{ color: GRAY, fontSize: 12 }}>→</div>
                </div>
              </button>
            );
          })}
        </div>

        <div style={{ marginTop: 16, fontSize: 10, color: GRAY, lineHeight: 1.7, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
          相性はロースターの優劣ではなく、あなたの好みとの近さです。診断を重ねるほど学習が進みます。
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
          <button onClick={reset} style={{ background: "none", border: `1px solid ${LINE}`, borderRadius: 999, padding: "7px 16px", fontSize: 11, color: GRAY, cursor: "pointer" }}>もう一度診断する</button>
          <button onClick={resetLearning} style={{ background: "none", border: "none", fontSize: 11, color: GRAY, cursor: "pointer", textDecoration: "underline", textUnderlineOffset: 2 }}>学習をリセット</button>
        </div>
      </div>
    );
  }

  // ---- 設問画面 ----
  const cq = QUESTIONS[step];
  return (
    <div className="bt-card" key={step}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, letterSpacing: "0.1em" }}>Q{step + 1} / {QUESTIONS.length}</div>
        {learnBadge}
      </div>
      <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
        {QUESTIONS.map((_, i) => (
          <span key={i} style={{ flex: 1, height: 3, borderRadius: 2, background: i <= step ? INK : LINE }} />
        ))}
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 14, lineHeight: 1.5 }}>{cq.q}</div>
      <div style={{ marginTop: 14 }}>
        {cq.options.map((o) => (
          <button key={o.label} onClick={() => answer(o.w)}
            style={{ display: "block", width: "100%", textAlign: "left", padding: "13px 14px", marginTop: 8, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8, fontSize: 13, color: INK, cursor: "pointer" }}>
            {o.label}
          </button>
        ))}
      </div>
      {step > 0 && (
        <button onClick={reset} style={{ marginTop: 14, background: "none", border: "none", fontSize: 11, color: GRAY, cursor: "pointer", padding: 0 }}>← 最初からやり直す</button>
      )}
    </div>
  );
}
