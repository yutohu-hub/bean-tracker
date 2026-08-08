"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";
import { getTastings, addDiagResult, addAnalysis } from "../lib/store";
import { FLAVORS } from "../data/flavors";
// 特徴量と記録分析はマイページと共通のロジックを使う（重複実装を持たない）
import { analyzeTastings, scoreRoasters, GROUP_LABEL } from "../lib/analysis";
import { reasonFor } from "../lib/roasterProfile";

/* ============================================================
   好み診断 — 回答・過去の診断・味の記録を混ぜて、いま買える店を相性順に出す。

   店の側の特徴は roasterProfile.js が「その店がいま並べている豆」から数える。
   以前は店の紹介文の語で 0/1 を付けていて、どう答えても 268 店中 39 店しか
   画面に出ず、147 店が同点で並ぶことがあった（実測。詳細は roasterProfile.js）。
   ============================================================ */

const LS_KEY = "bt_diag_profile_v2";

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
    { label: "アジア・日本の生産地", w: { asia: 2 } },
    { label: "こだわらず世界中から", w: {} },
  ]},
  { q: "精製方式への冒険度は?", options: [
    { label: "クリーンな Washed が基本", w: { clean: 1.5 } },
    { label: "Natural や Honey も好き", w: { natural: 1.5 } },
    { label: "Anaerobic など実験系も試したい", w: { experimental: 1.5, geisha: 0.8 } },
  ]},
  /* 「国内」は点数ではなく絞り込みにした。条件であって好みの強弱ではないので、
     どれだけ味が合っても海外の店を出したら答えになっていない。 */
  { q: "豆の買い方は?", options: [
    { label: "国内でさっと届いてほしい", w: {}, onlyJP: true },
    { label: "海外からの取り寄せも楽しい", w: {} },
  ]},
  /* 値段の設問を足した。100gあたりの値段は全 6,025 点に入っていて、
     産地や精製と同じくらい確かな手がかりなのに、これまで一度も使っていなかった。
     ¥300/100g の店と ¥4,000/100g の店が同じ顔で並ぶのは、相性以前の問題。 */
  { q: "1杯にかける値段は?", options: [
    { label: "毎日飲むので手頃に", w: { budget: 2 } },
    { label: "こだわりに見合う値段なら", w: {} },
    { label: "高くても特別な一杯を", w: { budget: -1.5, geisha: 0.5 } },
  ]},
];

const TYPE_OF = {
  light: "クリーン浅煎り型", africa: "アフリカ果実型", latam: "中南米バランス型",
  geisha: "レアロット探究型", experimental: "実験精製型", domestic: "国内デイリー型",
  asia: "アジア開拓型", medium: "オールラウンド型", budget: "デイリー実用型",
  clean: "クリーン志向型", natural: "甘み志向型",
};

/* 混ぜ方の強さ。今日の回答のベクトルは長さ6前後になるので、
   過去と記録がそれを超えないところに置いている。 */
const PAST_CAP = 4;      // 過去の診断で1つの特徴に貯まる上限
const PAST_W = 0.35;     // 過去の診断の効き
const LOG_W = 3.5;       // 味の記録の効き（記録側は長さ1に正規化済み）

function loadProfile() {
  try { return JSON.parse(localStorage.getItem(LS_KEY)) || { attr: {}, aff: {}, runs: 0 }; }
  catch { return { attr: {}, aff: {}, runs: 0 }; }
}
function saveProfile(p) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)); } catch {} }

export function DiagnosisView({ onRoaster }) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [profile, setProfile] = useState({ attr: {}, aff: {}, runs: 0 });
  const [tan, setTan] = useState(null); // 味の記録の分析結果
  const [diagSaved, setDiagSaved] = useState(false);
  const [anaSaved, setAnaSaved] = useState(false);
  const learned = useRef(0);            // 学習は1回の診断につき1度だけ

  useEffect(() => { setProfile(loadProfile()); setTan(analyzeTastings(getTastings())); }, []);

  // 設問の中で「記録から最も相性の良い」選択肢を提案（質問に学習を反映）
  const recIdx = (q) => {
    if (!tan || !tan.rated) return -1;
    let best = -1, bestS = 0.08;   // 記録側は長さ1なので、しきい値もその物差しで
    q.options.forEach((o, i) => {
      let s = 0; for (const [f, v] of Object.entries(o.w)) s += v * (tan.attr[f] || 0);
      if (s > bestS) { bestS = s; best = i; }
    });
    return best;
  };

  const answer = (o) => { setAnswers([...answers, o]); setStep(step + 1); };
  const reset = () => { setStep(0); setAnswers([]); setDiagSaved(false); setAnaSaved(false); };
  const resetLearning = () => { const p = { attr: {}, aff: {}, runs: 0 }; saveProfile(p); setProfile(p); };

  // 回答が出そろったらスコア計算
  const result = useMemo(() => {
    if (step < QUESTIONS.length) return null;
    // 今回の回答を特徴量重みに集約
    const aw = {};
    for (const o of answers) for (const [f, v] of Object.entries(o.w)) aw[f] = (aw[f] || 0) + v;
    const onlyJP = answers.some((o) => o.onlyJP);
    // 学習プロフィール(過去診断) + 味の記録の分析を混ぜる
    const blended = { ...aw };
    for (const [f, v] of Object.entries(profile.attr)) blended[f] = (blended[f] || 0) + v * PAST_W;
    if (tan) for (const [f, v] of Object.entries(tan.attr)) blended[f] = (blended[f] || 0) + v * LOG_W;

    const aff = {};
    for (const [k, v] of Object.entries(profile.aff || {})) aff[k] = v;
    if (tan) for (const [k, v] of Object.entries(tan.aff)) aff[k] = (aff[k] || 0) + v;

    const scored = scoreRoasters(blended, aff, { onlyJP });
    const topFeature = Object.entries(aw).sort((a, b) => b[1] - a[1])[0]?.[0] || "medium";
    return { list: scored.slice(0, 5).map((x) => x[0]), type: TYPE_OF[topFeature] || "オールラウンド型", aw, blended };
  }, [step, answers, profile, tan]);

  /* 結果が出た瞬間に学習（今回の好みを蓄積）。
     以前は「上位5店の並び」を依存にしていたので、同じ店が出た回は学習が
     飛んでいた。回数で数えるようにして、1回の診断につき必ず1度だけ動かす。 */
  useEffect(() => {
    if (!result || learned.current === answers.length) return;
    learned.current = answers.length;
    const p = loadProfile();
    for (const [f, v] of Object.entries(result.aw)) {
      p.attr[f] = Math.max(-PAST_CAP, Math.min(PAST_CAP, (p.attr[f] || 0) + v * 0.5));
    }
    p.runs = (p.runs || 0) + 1;
    saveProfile(p); setProfile(p);
  }, [result, answers.length]);

  useEffect(() => { if (step === 0) learned.current = 0; }, [step]);

  const pickRoaster = (k) => {
    const p = loadProfile();
    p.aff[k] = (p.aff[k] || 0) + 3; saveProfile(p); setProfile(p); // クリックは強い好みシグナル
    onRoaster(k);
  };

  const learnBadge = profile.runs > 0
    ? <span style={{ fontSize: 10, color: GREEN, fontWeight: 700 }}>🧠 学習中 · {profile.runs}回分の好みを反映</span>
    : <span style={{ fontSize: 10, color: GRAY }}>🧠 診断するほどおすすめが賢くなります</span>;

  // 味の記録のAI分析パネル（記録から学習して診断に反映）
  const AnalysisPanel = () => {
    if (!tan) return null;
    if (!tan.rated) {
      return (
        <div style={{ marginTop: 12, padding: "10px 12px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 10.5, color: GRAY, lineHeight: 1.7 }}>
          🧠 味の記録がまだありません。豆に☆評価を付けると、その傾向をAIが分析して診断に反映します。
        </div>
      );
    }
    const tags = [
      tan.topGroup && GROUP_LABEL[tan.topGroup],
      tan.topProc,
      tan.topFam && FLAVORS[tan.topFam] && FLAVORS[tan.topFam].label,
    ].filter(Boolean);
    return (
      <div style={{ marginTop: 12, padding: "12px 14px", background: "#F2F0E9", borderRadius: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 800 }}>🧠 記録のAI分析 <span style={{ fontWeight: 400, color: GRAY }}>· {tan.rated}件を学習</span></div>
        {tags.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            {tags.map((t) => (
              <span key={t} style={{ fontSize: 10.5, fontWeight: 700, color: INK, background: PAPER, border: `1px solid ${LINE}`, borderRadius: 999, padding: "3px 10px" }}>高評価: {t}</span>
            ))}
          </div>
        )}
        <div style={{ fontSize: 9.5, color: GRAY, marginTop: 8, lineHeight: 1.6 }}>
          この分析はこの端末上で行われ、記録は外部に送信されません。結果とおすすめに反映済みです。
        </div>
        <button
          onClick={() => { addAnalysis({ rated: tan.rated, tags }); setAnaSaved(true); }}
          disabled={anaSaved}
          style={{ width: "100%", marginTop: 10, padding: "9px 0", background: anaSaved ? "transparent" : PAPER, color: anaSaved ? GREEN : INK, border: `1.5px solid ${anaSaved ? LINE : INK}`, borderRadius: 8, fontSize: 11.5, fontWeight: 700, cursor: anaSaved ? "default" : "pointer" }}>
          {anaSaved ? "✓ 味の記録に保存しました" : "この分析を味の記録に保存"}
        </button>
      </div>
    );
  };

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
          あなたの回答・これまでの学習・<b>味の記録の分析</b>と、各店が<b>いま並べている豆の中身</b>を
          照らし合わせて選びました。
        </div>
        <AnalysisPanel />

        <div style={{ borderTop: `2px solid ${INK}`, marginTop: 16, paddingTop: 12 }}>
          {result.list.map((k, i) => {
            const r = ROASTERS[k];
            const why = reasonFor(k, result.blended);
            return (
              <button key={k} onClick={() => pickRoaster(k)}
                style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: i === 0 ? "#F2F0E9" : "none", border: "none", borderRadius: i === 0 ? 8 : 0, borderTop: i === 0 ? "none" : `1px solid ${LINE}`, padding: i === 0 ? "12px" : "11px 2px", cursor: "pointer", textAlign: "left" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    {i === 0 && <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 9, color: GREEN, fontWeight: 700 }}>BEST MATCH</span>}
                    <span style={{ fontSize: i === 0 ? 16 : 13, fontWeight: 700, color: INK }}>{r.name}</span>
                  </div>
                  <div style={{ fontSize: 10.5, color: GRAY, marginTop: 2 }}>{r.city} / {r.country} ・ {r.focus}</div>
                  {/* なぜこの店なのかを、数えた事実で書く。根拠が無いときは何も出さない */}
                  {why && <div style={{ fontSize: 10.5, color: INK, marginTop: 4 }}>{why}</div>}
                </div>
                <div style={{ textAlign: "right", flexShrink: 0, marginLeft: 10 }}>
                  <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GREEN }}>NOW {beansOf(k)}</div>
                  <div style={{ color: GRAY, fontSize: 12 }}>→</div>
                </div>
              </button>
            );
          })}
        </div>

        {/* 診断結果を味の記録に残す */}
        <button
          onClick={() => {
            const tags = [tan && tan.topGroup && GROUP_LABEL[tan.topGroup], tan && tan.topProc, tan && tan.topFam && FLAVORS[tan.topFam] && FLAVORS[tan.topFam].label].filter(Boolean);
            addDiagResult({ type: result.type, top: result.list.slice(0, 3), tags });
            setDiagSaved(true);
          }}
          disabled={diagSaved}
          style={{ width: "100%", marginTop: 16, padding: "12px 0", background: diagSaved ? "#EDEAE1" : INK, color: diagSaved ? GRAY : PAPER, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: diagSaved ? "default" : "pointer" }}>
          {diagSaved ? "✓ 味の記録に保存しました" : "🧭 この診断結果を味の記録に残す"}
        </button>
        {diagSaved && <div style={{ fontSize: 10.5, color: GREEN, marginTop: 6, textAlign: "center" }}>「味の記録」タブの診断履歴から見返せます。</div>}

        <div style={{ marginTop: 16, fontSize: 10, color: GRAY, lineHeight: 1.7, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
          相性はロースターの優劣ではなく、あなたの好みとの近さです。割合は在庫を数えた実数で、
          焙煎度だけは豆のデータに無いため店の紹介文から読んでいます。
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
      <AnalysisPanel />
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 14, lineHeight: 1.5 }}>{cq.q}</div>
      <div style={{ marginTop: 14 }}>
        {(() => {
          const rec = recIdx(cq);
          return cq.options.map((o, i) => (
            <button key={o.label} onClick={() => answer(o)}
              style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, width: "100%", textAlign: "left", padding: "13px 14px", marginTop: 8, background: i === rec ? "#F5F2E8" : PAPER, border: `1px solid ${i === rec ? INK : LINE}`, borderRadius: 8, fontSize: 13, color: INK, cursor: "pointer" }}>
              <span>{o.label}</span>
              {i === rec && <span style={{ flexShrink: 0, fontSize: 9.5, fontWeight: 800, color: GREEN, letterSpacing: "0.04em" }}>記録から ★</span>}
            </button>
          ));
        })()}
      </div>
      {step > 0 && (
        <button onClick={reset} style={{ marginTop: 14, background: "none", border: "none", fontSize: 11, color: GRAY, cursor: "pointer", padding: 0 }}>← 最初からやり直す</button>
      )}
    </div>
  );
}
