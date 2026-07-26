"use client";
import { INK, PAPER, GRAY, LINE, GREEN } from "../lib/theme";

// 競技会（World Brewers Cup）優勝者の抽出レシピ。追加は RECIPES に1件足すだけ。
// 数値・豆情報は公開情報に基づく。判明しない項目は空欄("")にして「情報準備中」を表示（捏造しない）。
const RECIPES = [
  {
    comp: "World Brewers Cup", year: "2025", flag: "🇨🇳", winner: "George Jinyang Peng",
    dripper: "SOLO Dripper",
    bean: [["生産国", "パナマ"], ["農園", "Mount Totumas（Cloud Forest）"], ["品種", "Geisha"], ["精製", "ナチュラル"], ["焙煎", "3通りに焙煎"], ["ロースター", "Captain George Coffee Roasters（中国・貴陽）"]],
    recipe: [["☕", "Coffee", "15g"], ["💧", "Water", "210g"], ["🌡", "Temperature", "96℃ → 80℃"], ["⚙", "Grind", "800μm"]],
    pours: [["0:00", "30g 注湯"], ["0:30", "90g 追加"], ["1:10", "90g 追加"]], total: "1:45",
  },
  {
    comp: "World Brewers Cup", year: "2024", flag: "🇦🇹", winner: "Martin Wölfl",
    dripper: "Orea V4 + Sibarist FAST",
    bean: [["生産国", "パナマ"], ["農園", "Finca Maya（Lost Origin Coffee Lab）"], ["品種", "Gesha"], ["精製", "ナチュラル・アナエロビック"], ["焙煎", "浅煎り"], ["ロースター", "Wildkaffee（オーストリア）"]],
    recipe: [["☕", "Coffee", "17g"], ["💧", "Water", "270g"], ["🌡", "Temperature", "93℃"], ["⚙", "Grind", "630μm"]],
    pours: [["0:00", "60g 蒸らし"], ["0:40", "60g 追加"], ["1:20", "50g 追加"], ["2:00", "100g 追加"]], total: "2:00",
  },
  {
    comp: "World Brewers Cup", year: "2023", flag: "🇨🇱", winner: "Carlos Medina",
    dripper: "Origami Dripper",
    bean: [["生産国", "コロンビア"], ["農園", "Café Granja La Esperanza"], ["品種", "Sidra（シドラ）"], ["精製", "ナチュラル"], ["焙煎", "浅煎り"], ["ロースター", ""]],
    recipe: [["☕", "Coffee", "16g"], ["💧", "Water", "250g"], ["🌡", "Temperature", "91℃"], ["⚙", "Grind", "中挽き（コニカル）"]],
    pours: [["0:00", "50g 注湯"], ["0:30", "50g 追加"], ["1:00", "50g 追加"], ["1:30", "50g 追加"], ["2:00", "50g 追加"]], total: "3:00",
  },
  {
    comp: "World Brewers Cup", year: "2022", flag: "🇹🇼", winner: "Shih Yuan Hsu（Sherry）",
    dripper: "Orea V3 + Kalita 185（1Zpresso K-Pro）",
    bean: [["生産国", "コロンビア"], ["農園", "Finca Mikava（Santuario Gesha）"], ["品種", "Geisha"], ["精製", "カーボニックマセレーション・ナチュラル"], ["焙煎", "浅煎り"], ["ロースター", "Mikava"]],
    recipe: [["☕", "Coffee", "14g"], ["💧", "Water", "200g"], ["🌡", "Temperature", "70℃ → 95℃"], ["⚙", "Grind", "1000μm 75% + 800μm 25%"]],
    pours: [], total: "",
  },
  {
    comp: "World Brewers Cup", year: "2021", flag: "🇨🇭", winner: "Matt Winton",
    dripper: "Hario V60（メタル・Five-Pour）",
    bean: [["生産国", "コロンビア / エクアドル"], ["農園", "Finca Inmaculada（Col）/ Hacienda La Florida（Ecu）"], ["品種", "Eugenioides × Catucai（ブレンド）"], ["精製", "ナチュラル / ウォッシュト"], ["焙煎", "浅煎り"], ["ロースター", "ROEST（Ona Coffee チーム）"]],
    recipe: [["☕", "Coffee", "20g"], ["💧", "Water", "300g"], ["🌡", "Temperature", "93℃ / 88℃（2ケトル）"], ["⚙", "Grind", "Kinu M47"]],
    pours: [["0:00", "60g 蒸らし"], ["0:30", "60g 追加"], ["1:00", "60g 追加"], ["1:30", "60g 追加"], ["2:00", "60g 追加"]], total: "2:40",
  },
  {
    comp: "World Brewers Cup", year: "2019", flag: "🇨🇳", winner: "Jia Ning Du（杜嘉宁）",
    dripper: "Origami Dripper",
    bean: [["生産国", "エチオピア"], ["農園", "Ninety Plus Gesha Estate"], ["品種", "Gesha"], ["精製", ""], ["焙煎", "浅煎り"], ["ロースター", "Ninety Plus Coffee"]],
    recipe: [["☕", "Coffee", "16g"], ["💧", "Water", "240g"], ["🌡", "Temperature", "94℃"], ["⚙", "Grind", "粗挽き→細挽き（2段階）"]],
    pours: [], total: "1:40",
  },
  {
    comp: "World Brewers Cup", year: "2018", flag: "🇨🇭", winner: "Emi Fukahori",
    dripper: "GINA（浸漬 + ドリップ）",
    bean: [["生産国", "ブラジル"], ["農園", "Daterra（Cerrado）"], ["品種", "Laurina（ブルボン変異種）"], ["精製", "セミ・カーボニックマセレーション"], ["焙煎", "浅煎り"], ["ロースター", "MAME Coffee"]],
    recipe: [["☕", "Coffee", "17g"], ["💧", "Water", "220g"], ["🌡", "Temperature", "80℃ / 95℃ / 80℃"], ["⚙", "Grind", "粗挽き"]],
    pours: [["0:00", "50g 浸漬 80℃（45秒）"], ["0:45", "100g ドリップ 95℃"], ["1:45", "70g 80℃"]], total: "2:55",
  },
  {
    comp: "World Brewers Cup", year: "2017", flag: "🇹🇼", winner: "Chad Wang",
    dripper: "Hario V60（センターポア）",
    bean: [["生産国", "パナマ"], ["農園", ""], ["品種", "Geisha"], ["精製", "ナチュラル（21日コールドファーメント）"], ["焙煎", "浅煎り"], ["ロースター", "Ninety Plus Coffee"]],
    recipe: [["☕", "Coffee", "15g"], ["💧", "Water", "250g"], ["🌡", "Temperature", "92℃"], ["⚙", "Grind", "細挽き"]],
    pours: [["0:00", "蒸らし（30秒）"], ["0:30", "中心に一点注ぎで残りを注湯"]], total: "2:15",
  },
  {
    comp: "World Brewers Cup", year: "2016", flag: "🇯🇵", winner: "Tetsu Kasuya（粕谷 哲）",
    dripper: "Hario V60（4:6メソッド）",
    bean: [["生産国", "パナマ"], ["農園", ""], ["品種", "Geisha"], ["精製", "ナチュラル"], ["焙煎", "浅〜中煎り"], ["ロースター", "Ninety Plus Coffee"]],
    recipe: [["☕", "Coffee", "20g"], ["💧", "Water", "300g"], ["🌡", "Temperature", "92℃"], ["⚙", "Grind", "粗挽き"]],
    pours: [["0:00", "50g 蒸らし"], ["0:45", "70g 追加"], ["1:30", "60g 追加"], ["2:15", "60g 追加"], ["3:00", "60g 追加"]], total: "3:30",
  },
  {
    comp: "World Brewers Cup", year: "2015", flag: "🇳🇴", winner: "Odd-Steinar Tøllefsen",
    dripper: "Hario V60",
    bean: [["生産国", "エチオピア / Sidamo"], ["農園", ""], ["品種", "Nekisse（在来種）"], ["精製", "ナチュラル"], ["焙煎", "浅煎り"], ["ロースター", "Supreme Roastworks"]],
    recipe: [["☕", "Coffee", "20g"], ["💧", "Water", "300g"], ["🌡", "Temperature", "92℃"], ["⚙", "Grind", ""]],
    pours: [["0:00", "蒸らし（45秒）"]], total: "3:30",
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
        <div style={{ fontSize: 21, fontWeight: 800, marginTop: 8, lineHeight: 1.3 }}>
          <span style={{ marginRight: 8 }}>{r.flag}</span>{r.winner}
        </div>
        {r.dripper && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
            <span style={{ fontSize: 10, color: "#B8AE9E" }}>DRIPPER</span>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{r.dripper}</span>
          </div>
        )}
      </div>

      <div style={{ padding: "16px 20px 22px", background: PAPER }}>
        {/* 豆情報 */}
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY }}>BEAN</div>
        <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
          <tbody>
            {r.bean.map(([k, v]) => (
              <tr key={k} style={{ borderTop: `1px solid ${LINE}` }}>
                <td style={{ padding: "7px 0", fontSize: 11.5, color: GRAY, width: 92, verticalAlign: "top" }}>{k}</td>
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
              <div style={{ fontFamily: "ui-monospace, monospace", fontSize: val && val.length > 10 ? 12 : 16, fontWeight: 800, color: val ? INK : GRAY, marginTop: 3, lineHeight: 1.3 }}>
                {val || "情報準備中"}
              </div>
            </div>
          ))}
        </div>

        {/* 注湯タイムライン */}
        <div style={{ fontFamily: "ui-monospace, monospace", fontSize: 10, letterSpacing: "0.15em", color: GRAY, marginTop: 20 }}>POUR</div>
        {r.pours.length === 0 ? (
          <div style={{ fontSize: 12, color: GRAY, marginTop: 8 }}>
            注湯スケジュールは情報準備中です。{r.total && <span style={{ fontFamily: "ui-monospace, monospace", color: INK, fontWeight: 700 }}> 総抽出 {r.total}</span>}
          </div>
        ) : (
          <div style={{ marginTop: 8, position: "relative", paddingLeft: 18 }}>
            <div style={{ position: "absolute", left: 4, top: 6, bottom: r.total ? 22 : 6, width: 2, background: LINE }} />
            {r.pours.map(([t, note], i) => (
              <div key={i} style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 12, padding: "6px 0" }}>
                <span style={{ position: "absolute", left: -18, top: 9, width: 10, height: 10, borderRadius: 999, background: GREEN, border: `2px solid ${PAPER}` }} />
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 13, fontWeight: 800, color: INK, width: 44, flexShrink: 0 }}>{t}</span>
                <span style={{ fontSize: 13, color: INK }}>{note}</span>
              </div>
            ))}
            {r.total && (
              <div style={{ position: "relative", display: "flex", alignItems: "baseline", gap: 12, paddingTop: 8, marginTop: 4, borderTop: `1px solid ${LINE}` }}>
                <span style={{ position: "absolute", left: -18, top: 12, width: 10, height: 10, borderRadius: 999, background: INK, border: `2px solid ${PAPER}` }} />
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 11, fontWeight: 700, color: GRAY, width: 44, flexShrink: 0 }}>TOTAL</span>
                <span style={{ fontFamily: "ui-monospace, monospace", fontSize: 15, fontWeight: 800, color: INK }}>{r.total}</span>
              </div>
            )}
          </div>
        )}
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
        World Brewers Cup 過去10大会の優勝者が使った豆と抽出レシピ。同じ一杯を、あなたの手で。<br />
        ※ 2020年は新型コロナのため中止。
      </p>

      {RECIPES.map((r, i) => <Recipe key={i} r={r} />)}

      <div style={{ marginTop: 22, padding: "12px 14px", border: `1px dashed ${LINE}`, borderRadius: 10, fontSize: 11, color: GRAY, lineHeight: 1.8 }}>
        ※ レシピ・豆情報は各種公開情報に基づく代表値です。「情報準備中」の項目は確認でき次第、順次追記します。
      </div>
    </div>
  );
}
