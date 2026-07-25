"use client";
import { useState } from "react";
import { INK } from "../lib/theme";

function domainOf(url) {
  if (!url) return null;
  try { return new URL(url.startsWith("http") ? url : "https://" + url).hostname; }
  catch { return null; }
}

// ロースターの実ロゴ（clearbit）。取得できない場合は店名テキストにフォールバック。
export function RoasterLogo({ roaster, size = 20 }) {
  const [err, setErr] = useState(false);
  const dom = domainOf(roaster && roaster.url);
  const logo = dom ? `https://logo.clearbit.com/${dom}` : null;
  if (logo && !err) {
    return (
      <img src={logo} alt={roaster.name} loading="lazy" onError={() => setErr(true)}
        style={{ height: size, maxWidth: "100%", objectFit: "contain", objectPosition: "left center", display: "block" }} />
    );
  }
  return (
    <span style={{ fontSize: Math.max(10, size * 0.55), fontWeight: 800, letterSpacing: "0.04em", color: INK }}>
      {roaster.name}
    </span>
  );
}
