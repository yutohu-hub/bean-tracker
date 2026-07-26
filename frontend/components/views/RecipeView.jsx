"use client";
import { INK, PAPER, GRAY, LINE, GREEN, AMBER } from "../lib/theme";

// 競技会（World Brewers Cup 等）優勝者の抽出レシピ。追加は RECIPES に1件足すだけ。
const RECIPES = [
  {
    comp: "World Brewers Cup",
    year: "2025",
    flag: "🇨🇳",
    winner: "George Jinyang Peng",
    dripper: "SOLO Dripper",
    bean: [
      ["生産国", ""],
      ["農園", ""],
      ["標高", ""],
      ["品種", ""],
      ["精製", ""],
      ["焙煎", ""],
      ["ロースター", ""],
    ],
    recipe: [
      ["☕", "Coffee", "15g"],
      ["💧", "Water", "210g"],
      ["🌡", "Temperature", "96℃ → 80℃"],
      ["⚙", "Grind", "800μm"],
    ],
    pours: [
      ["0:00", "30g 注湯"],
      ["0:30", "90g 追加"],
      ["1:10", "90g 追加"],
    ],
    total: "1:45",
  },
];

function Recipe({ r }) {
  return (
    <div style={{ border: `1.5px solid ${INK}`, borderRadius: 16, overflow: "hidden", marginTop: 18 }}>
      {/* ヘッダー */}
      <div style={{ padding: "18px 20px", background: "#141210", color: PAPER }}>
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.18em", color: "#E4B84A" }}>
          {r.comp.toUpperCase()} · {r.year}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, marginTop: 8, lineHeight: 1.3 }}>
          <span style={{ marginRight: 8 }}>{r.flag}</span>{r.winner}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 10, color: "#B8AE9E" }}>DRIPPER</span>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{r.dripper}</span>
        </div>
      </div>

      <div style={{ padding: "16px 20px 22px", background: PAPER }}>
        {/* 豆情報 */}
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>BEAN</div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
          <tbody>
            {r.bean.map(([k, v]) => (
              <tr key={k} style={{ borderTop: `1px solid ${LINE}` }}>
                <td style={{ padding: "7px 0", fontSize: 11.5, color: GRAY, width: 92 }}>{k}</td>
                <td style={{ padding: "7px 0", fontSize: 12.5, color: v ? INK : GRAY, fontWeight: v ? 600 : 400 }}>
                  {v || "情報準備中"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* レシピ（4指標） */}
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY, marginTop: 20 }}>RECIPE</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
          {r.recipe.map(([icon, label, val]) => (
            <div key={label} style={{ padding: "12px 14px", background: "#F7F5EF", borderRadius: 10 }}>
              <div style={{ fontSize: 10.5, color: GRAY }}>{icon} {label}</div>
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 16, fontWeight: 800, color: INK, marginTop: 3 }}>{val}</div>
            </div>
          ))}
        </div>

        {/* 注湯タイムライン */}
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY, marginTop: 20 }}>POUR</div>
        <div style={{ marginTop: 8, position: "relative", paddingLeft: 18 }}>
          <div style={{ position: "absolute", left: 4, top: 6, bottom: 22, width: 2, background: LINE }} />
          {r.pours.map(([t, note], i) => (
            <div key={i} style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 12, padding: "6px 0" }}>
              <span style={{ position: "absolute", left: -18, top: 9, width: 10, height: 10, borderRadius: 999, background: GREEN, border: `2px solid ${PAPER}` }} />
              <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 800, color: INK, width: 44, flexShrink: 0 }}>{t}</span>
              <span style={{ fontSize: 13, color: INK }}>{note}</span>
            </div>
          ))}
          <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 12, paddingTop: 8, marginTop: 4, borderTop: `1px solid ${LINE}` }}>
            <span style={{ position: "absolute", left: -18, top: 12, width: 10, height: 10, borderRadius: 999, background: INK, border: `2px solid ${PAPER}` }} />
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700, color: GRAY, width: 44, flexShrink: 0 }}>TOTAL</span>
            <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 15, fontWeight: 800, color: INK }}>{r.total}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export function RecipeView() {
  return (
    <div>
      <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.2em", color: GRAY }}>BREW RECIPES</div>
      <div style={{ fontSize: 22, fontWeight: 800, marginTop: 6, lineHeight: 1.35 }}>チャンピオンの抽出レシピ</div>
      <p style={{ fontSize: 12.5, color: GRAY, lineHeight: 1.9, marginTop: 8, marginBottom: 0 }}>
        世界大会・競技会の優勝者が使った豆と抽出レシピ。同じ一杯を、あなたの手で。
      </p>

      {RECIPES.map((r, i) => <Recipe key={i} r={r} />)}

      <div style={{ marginTop: 22, padding: "12px 14px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 11, color: GRAY, lineHeight: 1.8 }}>
        ※ 豆の詳細（生産国・農園・品種など）は判明し次第、順次追記します。レシピは公開情報に基づく代表値です。
      </div>
    </div>
  );
}
