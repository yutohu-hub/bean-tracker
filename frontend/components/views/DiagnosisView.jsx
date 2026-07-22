"use client";
import { useState } from "react";
import { INK, PAPER, GRAY, LINE } from "../lib/theme";
import { ROASTERS } from "../data/roasters";
import { QUESTIONS, TYPE_LABEL } from "../data/diagnosis";

const initScores = () => Object.fromEntries(Object.keys(ROASTERS).map((k) => [k, 0]));

export function DiagnosisView({ onRoaster }) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState(initScores);

  const answer = (pts) => {
    const next = { ...scores };
    Object.entries(pts).forEach(([k, v]) => { next[k] += v; });
    setScores(next);
    setStep(step + 1);
  };
  const reset = () => { setStep(0); setScores(initScores()); };

  if (step >= QUESTIONS.length) {
    const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
    const [topId] = sorted[0];
    const top = ROASTERS[topId];
    const t = TYPE_LABEL[topId];
    return (
      <div className="bt-card">
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, letterSpacing: "0.1em" }}>RESULT</div>
        <div style={{ fontSize: 21, fontWeight: 800, marginTop: 6 }}>{t.type}</div>
        <div style={{ fontSize: 12.5, color: GRAY, marginTop: 6, lineHeight: 1.7 }}>{t.desc}</div>

        <div style={{ borderTop: `2px solid ${INK}`, marginTop: 18, paddingTop: 14 }}>
          <div style={{ fontSize: 11, color: GRAY }}>いま一番相性が近いロースター</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 6 }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{top.name}</div>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY }}>{top.city}</span>
          </div>
          <div style={{ fontSize: 11.5, color: GRAY, marginTop: 2 }}>{top.note}</div>
          <button onClick={() => onRoaster(topId)}
            style={{ width: "100%", marginTop: 12, padding: "12px 0", background: INK, color: PAPER, border: "none", borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: "pointer" }}>
            この店の豆を見に行く →
          </button>
        </div>

        <div style={{ marginTop: 18 }}>
          <div style={{ fontSize: 11, color: GRAY, marginBottom: 4 }}>ほかの店との相性</div>
          {sorted.slice(1).map(([rid]) => (
            <button key={rid} onClick={() => onRoaster(rid)}
              style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%", background: "none", border: "none", borderTop: `1px solid ${LINE}`, padding: "11px 2px", cursor: "pointer", textAlign: "left" }}>
              <div>
                <span style={{ fontSize: 13, fontWeight: 700, color: INK }}>{ROASTERS[rid].name}</span>
                <span style={{ fontSize: 10.5, color: GRAY, marginLeft: 8 }}>{TYPE_LABEL[rid].type}</span>
              </div>
              <span style={{ color: GRAY }}>→</span>
            </button>
          ))}
        </div>

        <div style={{ marginTop: 16, fontSize: 10, color: GRAY, lineHeight: 1.7, borderTop: `1px solid ${LINE}`, paddingTop: 10 }}>
          この診断はロースターの優劣ではなく、あなたの好みとの相性です。答えが変われば近い店も変わります。
        </div>
        <button onClick={reset} style={{ marginTop: 12, background: "none", border: `1px solid ${LINE}`, borderRadius: 999, padding: "7px 16px", fontSize: 11, color: GRAY, cursor: "pointer" }}>
          もう一度診断する
        </button>
      </div>
    );
  }

  const q = QUESTIONS[step];
  return (
    <div className="bt-card" key={step}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, color: GRAY, letterSpacing: "0.1em" }}>
          Q{step + 1} / {QUESTIONS.length}
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {QUESTIONS.map((_, i) => (
            <span key={i} style={{ width: 14, height: 3, borderRadius: 2, background: i <= step ? INK : LINE }} />
          ))}
        </div>
        <p style={{ fontSize: 12, color: INK, lineHeight: 1.85, marginTop: 12, marginBottom: 0 }}>{roaster.bio}</p>
      </div>
      <div style={{ fontSize: 17, fontWeight: 700, marginTop: 12, lineHeight: 1.5 }}>{q.q}</div>
      <div style={{ marginTop: 16 }}>
        {q.options.map((o) => (
          <button key={o.label} onClick={() => answer(o.pts)}
            style={{
              display: "block", width: "100%", textAlign: "left", padding: "13px 14px", marginTop: 8,
              background: PAPER, border: `1px solid ${LINE}`, borderRadius: 8,
              fontSize: 13, color: INK, cursor: "pointer",
            }}>{o.label}</button>
        ))}
      </div>
      {step > 0 && (
        <button onClick={reset} style={{ marginTop: 14, background: "none", border: "none", fontSize: 11, color: GRAY, cursor: "pointer", padding: 0 }}>
          ← 最初からやり直す
        </button>
      )}
    </div>
  );
}
