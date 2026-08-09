"use client";
import { useState } from "react";
import { beanStyle } from "../lib/palette";

export function Package({ bean, small }) {
  const [imgErr, setImgErr] = useState(false);
  const st = beanStyle(bean); // 精製方法/レアで統一した色
  const bg = st.bg, accent = st.accent;

  // ① EC サイトの実際の商品画像があれば最優先で表示（巡回システムが bean.img に格納）
  if (bean.img && !imgErr) {
    return (
      <div style={{ borderRadius: 6, aspectRatio: "3 / 4", position: "relative", overflow: "hidden", background: "#EDEAE1", boxShadow: "0 1px 2px rgba(23,21,15,0.10)" }}>
        <img src={bean.img} alt={bean.name} loading="lazy" onError={() => setImgErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }

  // ② 実写が無い場合は標本カード（スタンドイン）を表示
  return (
    <div
      style={{
        background: bg,
        borderRadius: 6,
        aspectRatio: "3 / 4",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(23,21,15,0.10)",
      }}
    >
      {/* 袋の折り返し */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "12%", background: "rgba(23,21,15,0.10)", borderBottom: "1px solid rgba(23,21,15,0.12)" }} />
      {/* 精製方法。カードの下の文字には出ていないので、ここが唯一の置き場所になる。
          豆名とロースター名はすぐ下に大きく出るため、絵の中で繰り返さない
          （繰り返していた頃は、1枚のカードに同じ名前が2回ずつ並んでいた）。 */}
      <div style={{ position: "absolute", inset: "12% 10% 0", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ color: accent, fontSize: small ? 11 : 12, letterSpacing: "0.14em", fontWeight: 700, textAlign: "center", lineHeight: 1.4 }}>
          {bean.process.toUpperCase()}
        </span>
      </div>
      {/* 標本番号 */}
      <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "ui-monospace, monospace", fontSize: 8, color: accent, opacity: 0.7 }}>
        No.{String(bean.id).padStart(4, "0")}
      </div>
    </div>
  );
}
