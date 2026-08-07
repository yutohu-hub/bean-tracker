// 図鑑カードの色を「精製方法」で統一。100gあたり¥5,000以上は別色（レア）に統一。
import { per100JPY } from "./currency";

export const PREMIUM = { key: "premium", bg: "#2A2018", accent: "#E4B84A", label: "¥5,000+/100g" };
export const MIDHIGH = { key: "midhigh", bg: "#6E4356", accent: "#F3E7EC", label: "¥3,000–5,000/100g" };
export const PROC = {
  washed: { key: "washed", bg: "#3E6E7A", accent: "#EAF2F1", label: "Washed" },
  natural: { key: "natural", bg: "#8A3B2E", accent: "#F5EBE0", label: "Natural" },
  honey: { key: "honey", bg: "#C89A3A", accent: "#2E2A20", label: "Honey" },
  /* 以前は #7A2E6B。この1色が配色の見分けにくさを一手に引き受けていた。
     色差（CIEDE2000）で測ると、通常視覚でも色覚多様性でも基準を割っていた。

       通常視覚   anatural ↔ ¥3,000–5,000   ΔE 10.8（基準15）
       2型(deut)  Washed ↔ anatural         ΔE  7.3（基準8）
       3型(trit)  anatural ↔ ¥3,000–5,000   ΔE  6.1（基準8）

     紫という意味は残したまま、暗く濃い側へ寄せて全部満たすようにした。
     いまの最小は 通常16.4 / 1型11.6 / 2型11.0 / 3型10.2。 */
  anatural: { key: "anatural", bg: "#48205C", accent: "#F6E7F2", label: "Anaerobic Natural" },
  awashed: { key: "awashed", bg: "#4A4A9E", accent: "#E9E9F6", label: "Anaerobic Washed" },
  other: { key: "other", bg: "#6E655A", accent: "#F2ECE2", label: "その他" },
};

export function processKey(proc = "") {
  if (/Anaerobic\s*Natural/i.test(proc)) return "anatural";
  if (/Anaerobic\s*Washed/i.test(proc)) return "awashed";
  if (/Anaerobic/i.test(proc)) return "anatural";
  if (/Honey/i.test(proc)) return "honey";
  if (/Natural/i.test(proc)) return "natural";
  if (/Washed/i.test(proc)) return "washed";
  return "other";
}

// 豆の表示色（¥5,000+はレア、¥3,000–5,000は上位価格帯、それ以外は精製方法の色）
export function beanStyle(b) {
  const p = per100JPY(b);
  if (p >= 5000) return PREMIUM;
  if (p >= 3000) return MIDHIGH;
  return PROC[processKey(b.process)];
}

// 凡例（Washed / Natural / Honey / Anaerobic Natural / Anaerobic Washed / 価格帯2種）
export const LEGEND = [PROC.washed, PROC.natural, PROC.honey, PROC.anatural, PROC.awashed, { ...MIDHIGH, label: "¥3,000–5,000" }, { ...PREMIUM, label: "レア(¥5,000+)" }];
