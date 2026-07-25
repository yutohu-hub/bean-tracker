"use client";
import { useState } from "react";
import { ROASTERS } from "../data/roasters";

// roaster.url からロゴ取得用のドメインを取り出す
function domainOf(url) {
  if (!url) return null;
  try { return new URL(url.startsWith("http") ? url : "https://" + url).hostname; }
  catch { return null; }
}

export function Package({ bean, small }) {
  const roaster = ROASTERS[bean.r];
  const [imgErr, setImgErr] = useState(false);
  const [logoErr, setLogoErr] = useState(false);
  const dom = domainOf(roaster && roaster.url);
  const logo = dom ? `https://logo.clearbit.com/${dom}` : null;

  // ① EC サイトの実際の商品画像があれば最優先で表示（巡回システムが bean.img に格納）
  if (bean.img && !imgErr) {
    return (
      <div style={{ borderRadius: 6, aspectRatio: "3 / 4", position: "relative", overflow: "hidden", background: "#EDEAE1", boxShadow: "0 1px 2px rgba(23,21,15,0.10)" }}>
        <img src={bean.img} alt={bean.name} loading="lazy" onError={() => setImgErr(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
      </div>
    );
  }

  // ② 実写が無い場合のスタンドイン。ロースターの実ロゴを載せて「実際のお店」に近づける
  return (
    <div
      style={{
        background: bean.color,
        borderRadius: 6,
        aspectRatio: "3 / 4",
        position: "relative",
        overflow: "hidden",
        boxShadow: "0 1px 2px rgba(23,21,15,0.10)",
      }}
    >
      {/* 袋の折り返し */}
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: "12%", background: "rgba(23,21,15,0.10)", borderBottom: "1px solid rgba(23,21,15,0.12)" }} />
      {/* ロースターマーク（実ロゴ→失敗時は店名テキスト） */}
      {logo && !logoErr ? (
        <div style={{ position: "absolute", top: "16%", left: 0, right: 0, display: "flex", justifyContent: "center" }}>
          <img src={logo} alt={roaster.name} loading="lazy" onError={() => setLogoErr(true)}
            style={{ height: small ? 18 : 22, maxWidth: "66%", objectFit: "contain", background: "rgba(255,255,255,0.82)", borderRadius: 4, padding: "2px 5px" }} />
        </div>
      ) : (
        <div style={{ position: "absolute", top: "18%", left: 0, right: 0, textAlign: "center", color: bean.accent, fontSize: small ? 8 : 9, letterSpacing: "0.18em", fontWeight: 700 }}>
          {roaster.name.toUpperCase()}
        </div>
      )}
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
