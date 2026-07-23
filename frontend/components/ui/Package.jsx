"use client";
import { ROASTERS } from "../data/roasters";

export function Package({ bean, small }) {
  const roaster = ROASTERS[bean.r];
  const faded = bean.status === "archive";
  return (
    <div
      style={{
        background: bean.color,
        borderRadius: 6,
        aspectRatio: "3 / 4",
        position: "relative",
        overflow: "hidden",
        filter: faded ? "grayscale(0.55) contrast(0.92)" : "none",
        opacity: faded ? 0.85 : 1,
        boxShadow: "0 1px 2px rgba(23,21,15,0.10)",
      }}
    >
      {/* 袋の折り返し */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "12%", background: "rgba(23,21,15,0.10)", borderBottom: "1px solid rgba(23,21,15,0.12)" }} />
      {/* ロースターマーク */}
      <div style={{ position: "absolute", top: "18%", left: 0, right: 0, textAlign: "center", color: bean.accent, fontSize: small ? 8 : 9, letterSpacing: "0.18em", fontWeight: 700 }}>
        {roaster.name.toUpperCase()}
      </div>
      {/* 豆名ラベル */}
      <div style={{ position: "absolute", top: "38%", left: "10%", right: "10%", textAlign: "center" }}>
        <div style={{ color: bean.accent, fontWeight: 700, fontSize: small ? 11 : 13, lineHeight: 1.25 }}>{bean.name}</div>
        <div style={{ marginTop: 6, height: 1, background: bean.accent, opacity: 0.5 }} />
        <div style={{ marginTop: 6, color: bean.accent, fontSize: small ? 8 : 9, letterSpacing: "0.08em", opacity: 0.9 }}>
          {bean.process.toUpperCase()}
        </div>
      </div>
      {/* 標本番号 */}
      <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "ui-monospace, monospace", fontSize: 8, color: bean.accent, opacity: 0.7 }}>
        No.{String(bean.id).padStart(4, "0")}
      </div>
    </div>
  );
}
