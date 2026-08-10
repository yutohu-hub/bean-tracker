"use client";
import { useState } from "react";
import { FS, INK, GRAY, LINE, GREEN } from "../lib/theme";

// 競技会（World Brewers Cup）優勝者の抽出レシピ。追加は RECIPES に1件足すだけ。
// 数値・豆情報は公開情報に基づく。判明しない項目は空欄("")にして「情報準備中」を表示（捏造しない）。
// note は、大会レポートや本人の解説で語られていた「その一杯の勘所」。出典が無いものは書かない。
const RECIPES = [
  {
    comp: "World Brewers Cup", year: "2026", flag: "🇲🇾", winner: "Nas Jaafar",
    video: "D8LEI2HJR5s",
    dripper: "UFO V3 + Hario Switch（浸漬×透過）",
    bean: [["生産国", "パナマ"], ["農園", "Finca Nuguo（標高1,700m）"], ["品種", "Geisha"], ["精製", "アナエロビック・ナチュラル"], ["焙煎", "浅煎り（熱風焙煎・焙煎3日後に使用）"], ["ロースター", ""]],
    recipe: [["☕", "Coffee", "15g"], ["💧", "Water", "200g"], ["🌡", "Temperature", "92℃"], ["⚙", "Grind", "約700μm"]],
    pours: [["0:00", "100g 透過（円を描いて注湯）"], ["0:58", "スイッチを閉じる"], ["1:00", "100g 浸漬"], ["2:00", "スイッチを開く"]], total: "2:10",
    note: "スイッチ付きの台に載せ、前半を透過、後半を浸漬にした一杯。ブリュッセル大会でマレーシア初の優勝。オーストラリア・香港・チェコ・韓国・フランスの代表を抑えての結果だった。",
  },
  {
    comp: "World Brewers Cup", year: "2025", flag: "🇨🇳", winner: "George Jinyang Peng",
    video: "qmCtGAODMdg",
    dripper: "SOLO Dripper",
    bean: [["生産国", "パナマ"], ["農園", "Mount Totumas（Cloud Forest）"], ["品種", "Geisha"], ["精製", "ナチュラル"], ["焙煎", "3通りに焙煎"], ["ロースター", "Captain George Coffee Roasters（中国・貴陽）"]],
    recipe: [["☕", "Coffee", "15g"], ["💧", "Water", "210g"], ["🌡", "Temperature", "96℃ → 80℃"], ["⚙", "Grind", "800μm"]],
    pours: [["0:00", "30g 注湯"], ["0:30", "90g 追加"], ["1:10", "90g 追加"]], total: "1:45",
    note: "同じ豆を3通りに焙煎し分けて配合した回。高温で立ち上げ、後半は80℃まで下げて渋みを出さずに終える。",
  },
  {
    comp: "World Brewers Cup", year: "2024", flag: "🇦🇹", winner: "Martin Wölfl",
    video: "xbFpaEboy_g",
    dripper: "Orea V4（平底）",
    filter: "Sibarist FAST（不織布・抜けが速い）",
    bean: [["生産国", "パナマ"], ["農園", "Finca Maya（Lost Origin Coffee Lab）"], ["品種", "Gesha"], ["精製", "ナチュラル・アナエロビック"], ["焙煎", "浅煎り"], ["ロースター", "Wildkaffee（オーストリア）"]],
    recipe: [["☕", "Coffee", "17g"], ["💧", "Water", "270g"], ["🌡", "Temperature", "93℃"], ["⚙", "Grind", "630μm"]],
    pours: [["0:00", "60g 蒸らし"], ["0:40", "60g 追加"], ["1:20", "50g 追加"], ["2:00", "100g 追加"]], total: "2:00",
    gear: "Melodrip（注湯の勢いを殺す道具）",
    water: "Apax（抽出用に組成を調整した水）",
    hardness: "",
    taste: "ハネーデュー・ローズヒップ・チェリー",
    note: "平底の Orea に抜けの速い Sibarist の紙を合わせ、細挽き（630μm）でも詰まらせずに落としきる組み合わせ。"
      + "さらに Melodrip で湯を面で落とし、粉を掘らずに濡らしている。",
  },
  {
    comp: "World Brewers Cup", year: "2023", flag: "🇨🇱", winner: "Carlos Medina",
    video: "Ed8w-RKhR5U",
    dripper: "Origami Dripper",
    bean: [["生産国", "コロンビア"], ["農園", "Café Granja La Esperanza（Finca Potosí）"], ["品種", "Sidra（シドラ）"], ["精製", "ナチュラル"], ["焙煎", "浅煎り"], ["ロースター", "Colibrí Coffee Roasters（サンティアゴ・本人が焙煎）"]],
    recipe: [["☕", "Coffee", "16g"], ["💧", "Water", "250g"], ["🌡", "Temperature", "91℃"], ["⚙", "Grind", "中挽き（コニカル）"]],
    pours: [["0:00", "50g 注湯"], ["0:30", "50g 追加"], ["1:00", "50g 追加"], ["1:30", "50g 追加"], ["2:00", "50g 追加"]], total: "3:00",
    note: "ラテンアメリカ勢初の優勝。ゲイシャで正面から張り合うのを避け、あえてシドラを選んだと語っている。比率は 1:16。",
  },
  {
    comp: "World Brewers Cup", year: "2022", flag: "🇹🇼", winner: "Shih Yuan Hsu（Sherry）",
    video: "sTroaHo5zsk",
    dripper: "Orea V3（平底）",
    filter: "Kalita 185（台形の紙をV60形に敷く）",
    grinder: "1Zpresso K-Pro",
    bean: [["生産国", "コロンビア"], ["農園", "Finca Mikava（Santuario Gesha）"], ["品種", "Geisha"], ["精製", "カーボニックマセレーション・ナチュラル"], ["焙煎", "浅煎り"], ["ロースター", "Mikava"]],
    recipe: [["☕", "Coffee", "14g"], ["💧", "Water", "200g"], ["🌡", "Temperature", "70℃ → 95℃"], ["⚙", "Grind", "1000μm 75% + 800μm 25%"]],
    pours: [["0:00", "50g 注湯（70℃）"], ["0:30", "50g 追加（95℃）"], ["1:00", "50g 追加（95℃）"], ["1:30", "50g 追加（95℃）"]], total: "",
    note: "50gを30秒ごとに4回。1投目だけ70℃で、残り3投を95℃にする二温度の抽出。"
      + "低温で入ると最初に出る強い酸を抑えられ、そのあと高温で甘みと厚みを足せる。挽き目も粗さの違う2種を混ぜている。",
  },
  {
    comp: "World Brewers Cup", year: "2021", flag: "🇨🇭", winner: "Matt Winton",
    video: "_7azuIxdRF4",
    dripper: "Hario V60（メタル・Five-Pour）",
    grinder: "Kinu M47",
    bean: [["生産国", "コロンビア / エクアドル"], ["農園", "Finca Inmaculada（Col）/ Hacienda La Florida（Ecu）"], ["品種", "Eugenioides × Catucai（ブレンド）"], ["精製", "ナチュラル / ウォッシュト"], ["焙煎", "浅煎り"], ["ロースター", "ROEST（Ona Coffee チーム）"]],
    recipe: [["☕", "Coffee", "20g"], ["💧", "Water", "300g"], ["🌡", "Temperature", "93℃ / 88℃（2ケトル）"], ["⚙", "Grind", "Kinu M47"]],
    pours: [["0:00", "60g 蒸らし"], ["0:30", "60g 追加"], ["1:00", "60g 追加"], ["1:30", "60g 追加"], ["2:00", "60g 追加"]], total: "2:40",
    note: "60gを5回、温度の違う2つのケトルを使い分ける Five-Pour。ユーゲニオイデスという珍しい種を混ぜたブレンドで勝った回。",
  },
  {
    comp: "World Brewers Cup", year: "2019", flag: "🇨🇳", winner: "Jia Ning Du（杜嘉宁）",
    video: "HNDnngFhZMU",
    dripper: "Origami Dripper",
    bean: [["生産国", "エチオピア"], ["農園", "Ninety Plus Gesha Estate（標高1,600m）"], ["品種", "Gesha"], ["精製", "現地の野生バクテリアで発酵（Ninety Plus 製法）"], ["焙煎", "浅煎り"], ["ロースター", "Ninety Plus Coffee"]],
    recipe: [["☕", "Coffee", "16g"], ["💧", "Water", "240g"], ["🌡", "Temperature", "94℃"], ["⚙", "Grind", "粗挽き→細挽き（2段階）"]],
    pours: [["1投目", "60g（6g/秒 × 10秒）"], ["2投目", "80g（4g/秒 × 20秒）"]], total: "1:40",
    water: "カルシウム 4ppm / マグネシウム 15ppm",
    hardness: "総硬度 約72ppm（CaCO₃換算）",
    note: "中国初の優勝。まず極粗挽きでシルバースキンを飛ばし、挽き直して表面積を稼ぐ二段階グラインド。注湯は流速まで決めている。公開されているのは2投目まで。",
  },
  {
    comp: "World Brewers Cup", year: "2018", flag: "🇨🇭", winner: "Emi Fukahori",
    video: "2H9gvo4Zma4",
    dripper: "GINA（浸漬 + ドリップ）",
    bean: [["生産国", "ブラジル"], ["農園", "Daterra（Cerrado）"], ["品種", "Laurina（ブルボン変異種）"], ["精製", "セミ・カーボニックマセレーション"], ["焙煎", "浅煎り"], ["ロースター", "MAME Coffee"]],
    recipe: [["☕", "Coffee", "17g"], ["💧", "Water", "220g"], ["🌡", "Temperature", "80℃ / 95℃ / 80℃"], ["⚙", "Grind", "粗挽き"]],
    pours: [["0:00", "50g 浸漬 80℃（45秒）"], ["0:45", "100g ドリップ 95℃"], ["1:45", "70g 80℃"]], total: "2:55",
    note: "浸漬から透過へ切り替えられる GINA で、低温→高温→低温と3段階に振った一杯。豆はブルボンの突然変異種ラウリーナ。",
  },
  {
    comp: "World Brewers Cup", year: "2017", flag: "🇹🇼", winner: "Chad Wang",
    video: "rXdhzy2piMk",
    dripper: "Hario V60（センターポア）",
    bean: [["生産国", "パナマ"], ["農園", "Ninety Plus Geisha Estates（Volcán）"], ["品種", "Geisha"], ["精製", "ナチュラル（21日コールドファーメント）"], ["焙煎", "浅煎り"], ["ロースター", "Ninety Plus Coffee"]],
    recipe: [["☕", "Coffee", "15g"], ["💧", "Water", "250g"], ["🌡", "Temperature", "92℃"], ["⚙", "Grind", "細挽き"]],
    pours: [["0:00", "蒸らし（30秒）"], ["0:30", "中心に一点注ぎで残りを注湯"]], total: "2:15",
    note: "産地で300種を飲み比べて選んだ227番目のロット。1月に摘んだ紫色の完熟チェリーだけを使い、大会3日前にブダペストで焙煎した。",
  },
  {
    comp: "World Brewers Cup", year: "2016", flag: "🇯🇵", winner: "Tetsu Kasuya（粕谷 哲）",
    video: "pAKNvBu8YlI",
    dripper: "Hario V60（4:6メソッド）",
    bean: [["生産国", "パナマ"], ["農園", "Ninety Plus Geisha Estate（ロット: Sylvia）"], ["品種", "Geisha"], ["精製", "ナチュラル"], ["焙煎", "浅〜中煎り"], ["ロースター", "Ninety Plus Coffee"]],
    recipe: [["☕", "Coffee", "20g"], ["💧", "Water", "300g"], ["🌡", "Temperature", "92℃"], ["⚙", "Grind", "粗挽き"]],
    pours: [["0:00", "50g 蒸らし"], ["0:45", "70g 追加"], ["1:30", "60g 追加"], ["2:15", "60g 追加"], ["3:00", "60g 追加"]], total: "3:30",
    note: "アジア初の優勝。最初の40%（120g）で酸味と甘みの釣り合いを決め、残り60%で濃さを決める「4:6メソッド」。前半2投の配分を変えれば味の方向を動かせる。",
  },
  {
    comp: "World Brewers Cup", year: "2015", flag: "🇳🇴", winner: "Odd-Steinar Tøllefsen",
    dripper: "Hario V60",
    bean: [["生産国", "エチオピア / Sidamo"], ["農園", "Ninety Plus Maker Series（Maker: Semeon Abbay）"], ["品種", "Nekisse（在来種）"], ["精製", "ナチュラル"], ["焙煎", "浅煎り"], ["ロースター", "Supreme Roastworks"]],
    recipe: [["☕", "Coffee", "20g"], ["💧", "Water", "300g"], ["🌡", "Temperature", "92℃"], ["⚙", "Grind", ""]],
    pours: [["0:00", "蒸らし（45秒）"]], total: "3:30",
    water: "ノルウェー西海岸の天然水",
    hardness: "低ミネラル（数値は非公開）",
    taste: "完熟トロピカルフルーツ・アプリコット・マンゴー・パッションフルーツ・苺",
    note: "水にノルウェー西海岸の天然水を使用。ミネラルが少なく口当たりが柔らかくなるものを選んだと語っている。"
      + "比率は 1:15、蒸らし45秒で総抽出3分30秒と、いまの競技レシピと比べるとゆっくりめ。",
  },
];

/* 数値から比率（豆1に対する湯）を出す。11杯を見比べるとき、いちばん効く1つの数字。
   「レシピの読み方」でも最初に挙げているのに、これまでは自分で割り算する必要があった。
   湯量は "240g（Ca 4ppm / Mg 15ppm）" のように但し書きが付く回があるので、先頭の数だけ読む。 */
function ratioOf(recipe) {
  const num = (label) => {
    const row = recipe.find(([, l]) => l === label);
    const m = row && String(row[2]).match(/[\d.]+/);
    return m ? parseFloat(m[0]) : 0;
  };
  const c = num("Coffee"), w = num("Water");
  if (!c || !w) return null;
  return `1:${(w / c).toFixed(1).replace(/\.0$/, "")}`;
}

/* 競技の様子。押されるまで iframe を作らない。
   11件ぶんを最初から埋め込むと、その1画面で YouTube のプレイヤーを11個
   読み込むことになり、開くだけで重くなる。押した1つだけを載せる。
   表紙は YouTube の画像を直に使う（こちらで持たない）。
   埋め込み先は nocookie 版にして、見るまで足跡を残さない。 */
function Video({ id, title }) {
  const [on, setOn] = useState(false);
  if (on) {
    return (
      <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", marginTop: 8, borderRadius: 10, overflow: "hidden", background: "#000" }}>
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0`}
          title={title} allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowFullScreen
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: "none" }} />
      </div>
    );
  }
  return (
    <button onClick={() => setOn(true)} aria-label={`${title} を再生`}
      style={{ position: "relative", display: "block", width: "100%", aspectRatio: "16 / 9", marginTop: 8,
        padding: 0, border: "none", borderRadius: 10, overflow: "hidden", cursor: "pointer", background: "#000" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`https://i.ytimg.com/vi/${id}/hqdefault.jpg`} alt="" loading="lazy"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block", opacity: 0.82 }} />
      <span style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <span style={{ width: 54, height: 38, borderRadius: 9, background: "rgba(23,21,15,0.78)",
          display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: FS.body }}>▶</span>
      </span>
    </button>
  );
}

const MONO = "ui-monospace, monospace";

/* 升の見出しは横4つに収まる長さにする。"Temperature" だけ2行に折れて、
   その升だけ背が高くなっていた。元データは触らず、表示名だけ短くする。 */
const SHORT = { Temperature: "Temp" };
const cap = { fontFamily: MONO, fontSize: FS.meta, letterSpacing: "0.15em", color: GRAY };

/* 一覧の1行。開くまでは、見比べるのに要る分だけ出す。
   11杯ぶんを全部開いたまま並べると 10,500px（携帯で12画面）になり、
   目当ての回に辿り着くまで延々スクロールすることになっていた。 */
function Row({ r, open, onToggle }) {
  const ratio = ratioOf(r.recipe);
  const country = (r.bean.find(([k]) => k === "生産国") || [])[1];
  const variety = (r.bean.find(([k]) => k === "品種") || [])[1];
  return (
    <div style={{ borderTop: `1px solid ${LINE}` }}>
      <button onClick={onToggle} aria-expanded={open}
        style={{ display: "flex", alignItems: "flex-start", gap: 12, width: "100%", textAlign: "left",
          background: "none", border: "none", padding: "14px 2px", cursor: "pointer" }}>
        <span style={{ fontFamily: MONO, fontSize: FS.body, color: GRAY, width: 34, flexShrink: 0, paddingTop: 2 }}>{r.year}</span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: "block", fontSize: FS.lead, fontWeight: 700, color: INK }}>
            <span style={{ marginRight: 6 }}>{r.flag}</span>{r.winner}
          </span>
          <span style={{ display: "block", fontSize: FS.meta, color: GRAY, marginTop: 3, lineHeight: 1.6 }}>
            {r.dripper}
          </span>
          <span style={{ display: "block", fontSize: FS.meta, color: GRAY, marginTop: 2 }}>
            {[country, variety].filter(Boolean).join(" · ")}
          </span>
        </span>
        <span style={{ flexShrink: 0, textAlign: "right", paddingTop: 1 }}>
          {ratio && <span style={{ display: "block", fontFamily: MONO, fontSize: FS.lead, fontWeight: 800, color: INK }}>{ratio}</span>}
          {/* 11行すべてに「開く」と書くと、その文字だけで一覧が埋まる。
              行ごと押せることは見出しの一文で伝えてあるので、印は記号だけにする。 */}
          <span aria-label={open ? "閉じる" : "開く"}
            style={{ display: "block", fontSize: FS.meta, color: GRAY, marginTop: 5 }}>{open ? "▲" : "▼"}</span>
        </span>
      </button>
      {open && <Detail r={r} />}
    </div>
  );
}

function Detail({ r }) {
  const rows = (list) => (
    <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 6 }}>
      <tbody>
        {list.map(([k, v]) => (
          <tr key={k} style={{ borderTop: `1px solid ${LINE}` }}>
            <td style={{ padding: "7px 0", fontSize: FS.meta, color: GRAY, width: 92, verticalAlign: "top" }}>{k}</td>
            <td style={{ padding: "7px 0", fontSize: FS.body, color: v ? INK : GRAY }}>{v || "情報準備中"}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div style={{ padding: "2px 2px 22px" }}>
      {/* 4指標。見比べる数字なので等幅で揃える */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(88px, 1fr))", gap: 8 }}>
        {r.recipe.map(([icon, label, val]) => (
          <div key={label} style={{ padding: "10px 12px", background: "#F7F5EF", borderRadius: 10 }}>
            <div style={{ fontSize: FS.meta, color: GRAY }}>{icon} {SHORT[label] || label}</div>
            <div style={{ fontFamily: MONO, fontSize: val && val.length > FS.meta ? FS.meta : FS.lead, fontWeight: 800,
              color: val ? INK : GRAY, marginTop: 3, lineHeight: 1.3 }}>{val || "情報準備中"}</div>
          </div>
        ))}
      </div>

      {/* 注ぎ方。時刻と量だけの並びなので、線と点は引かず素の行にする */}
      <div style={{ ...cap, marginTop: 18 }}>POUR</div>
      {r.pours.length === 0 ? (
        <div style={{ fontSize: FS.body, color: GRAY, marginTop: 6, lineHeight: 1.8 }}>
          注湯の時刻と配分は公開されていません。
          {r.total && <span style={{ fontFamily: MONO, color: INK, fontWeight: 700 }}> 総抽出 {r.total}</span>}
        </div>
      ) : (
        <div style={{ marginTop: 6 }}>
          {r.pours.map(([t, note], i) => (
            <div key={i} style={{ display: "flex", gap: 12, padding: "6px 0", borderTop: i ? `1px solid ${LINE}` : "none" }}>
              <span style={{ fontFamily: MONO, fontSize: FS.body, fontWeight: 700, color: GREEN, width: 46, flexShrink: 0 }}>{t}</span>
              <span style={{ fontSize: FS.body, color: INK, lineHeight: 1.6 }}>{note}</span>
            </div>
          ))}
          {r.total && (
            <div style={{ display: "flex", gap: 12, padding: "8px 0 0", marginTop: 4, borderTop: `1px solid ${INK}` }}>
              <span style={{ fontFamily: MONO, fontSize: FS.meta, fontWeight: 700, color: GRAY, width: 46, flexShrink: 0 }}>TOTAL</span>
              <span style={{ fontFamily: MONO, fontSize: FS.body, fontWeight: 800, color: INK }}>{r.total}</span>
            </div>
          )}
        </div>
      )}

      {r.video && (
        <>
          <div style={{ ...cap, marginTop: 18 }}>VIDEO</div>
          <div style={{ fontSize: FS.meta, color: GRAY, marginTop: 4 }}>
            {r.year} 年、{r.winner} 本人の競技映像。
          </div>
          <Video id={r.video} title={`${r.winner} — ${r.year} World Brewers Cup 決勝`} />
        </>
      )}

      <div style={{ ...cap, marginTop: 18 }}>BEAN</div>
      {rows(r.bean)}

      {/* 抽出の条件。ドリッパー・紙・グラインダー・水は、同じ豆でも味を変える。
          分かっているものだけを行にして、無いものは最後に1行でまとめる。
          「情報準備中」を項目ごとに並べると、1件につき4行が空欄で埋まり、
          何が分かっているのかが読み取りにくくなる。かといって黙って消すと、
          調べていないのか公開されていないのかが伝わらない。 */}
      {(() => {
        const all = [
          ["ドリッパー", r.dripper], ["ペーパー", r.filter], ["グラインダー", r.grinder],
          ["水", r.water], ["水の硬度", r.hardness], ["補助道具", r.gear], ["申告した味わい", r.taste],
        ];
        const known = all.filter(([, v]) => v);
        const missing = all.filter(([, v]) => !v).map(([k]) => k);
        return (
          <>
            <div style={{ ...cap, marginTop: 18 }}>SETUP</div>
            {known.length > 0 && rows(known)}
            {missing.length > 0 && (
              <div style={{ fontSize: FS.meta, color: GRAY, lineHeight: 1.8, marginTop: known.length ? 8 : 6 }}>
                {missing.join("・")} は公開されていません。
              </div>
            )}
          </>
        );
      })()}

      {r.note && (
        <p style={{ fontSize: FS.body, color: INK, lineHeight: 1.9, margin: "18px 0 0",
          paddingTop: 14, borderTop: `1px solid ${LINE}` }}>{r.note}</p>
      )}
    </div>
  );
}

export function RecipeView() {
  // 開くのは1つずつ。複数開けると、結局もとの長さに戻ってしまう
  const [open, setOpen] = useState(0);
  const [guide, setGuide] = useState(false);

  return (
    <div>
      <div style={{ fontFamily: MONO, fontSize: FS.meta, letterSpacing: "0.2em", color: GRAY }}>BREW RECIPES</div>
      <div style={{ fontSize: FS.title, fontWeight: 800, marginTop: 6, lineHeight: 1.35 }}>チャンピオンの抽出レシピ</div>
      <p style={{ fontSize: FS.body, color: GRAY, lineHeight: 1.9, marginTop: 8, marginBottom: 0 }}>
        World Brewers Cup 過去11大会の優勝者が使った豆と抽出レシピ。
        右の数字は豆1に対する湯の量です。行をタップすると全部出ます。
      </p>

      {/* 読み方は一度読めば足りる説明なので畳んでおく。一覧より先に長文が来ると、
          目的のレシピに辿り着く前に画面が埋まる。 */}
      <button onClick={() => setGuide(!guide)}
        style={{ display: "block", marginTop: 14, background: "none", border: "none", padding: 0,
          cursor: "pointer", fontSize: FS.body, color: INK, fontWeight: 700 }}>
        レシピの読み方 {guide ? "▲" : "▼"}
      </button>
      {guide && (
        <div style={{ marginTop: 10, padding: "14px 16px", background: "#F7F5EF", borderRadius: 12 }}>
          <p style={{ fontSize: FS.body, color: GRAY, lineHeight: 1.9, margin: 0 }}>
            豆も水も器具も違えば、同じ数字でも同じ味にはなりません。
            真似るより、<strong style={{ color: INK }}>どの数字を動かすと味がどちらへ動くか</strong>を掴むほうが早いはずです。
          </p>
          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            {[
              ["比率", "豆1に対する湯の量。1:15 は濃く、1:17 は軽い。まず1:16から始めて、濃さの好みで前後させる。"],
              ["湯温", "高いほど成分が早く出る。浅煎りは93〜96℃で立ち上げ、渋みが出るなら下げる。90℃を切ると酸が立ちやすい。"],
              ["挽き目", "細かいほど濃く、詰まると渋くなる。落ちきる時間が予定より長ければ粗く、短ければ細かく。"],
              ["注ぐ回数", "回数が多いほど濃く出る。総量が同じでも、3回に分ければ1回で注ぐより濃い。"],
              ["前半の配分", "4:6メソッドでは、最初の40%の2投で味の方向が決まる。1投目を少なくすると甘く、多くすると明るくなる。"],
              ["ペーパー", "抜けの速さが変わる。速い紙（Sibarist など）は細かく挽いても詰まらず、遅い紙は同じ挽き目でも濃く出る。同じレシピで味が合わないとき、まず疑うところ。"],
              ["水", "下の「水のこと」を参照。硬度が違うと、同じ豆でも出方が変わる。"],
            ].map(([k, v]) => (
              <div key={k} style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                <span style={{ flexShrink: 0, width: 62, fontSize: FS.meta, fontWeight: 800, color: INK, paddingTop: 1 }}>{k}</span>
                <span style={{ fontSize: FS.body, color: INK, lineHeight: 1.8 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {guide && (
        /* 硬度は「水に溶けているカルシウムとマグネシウムの量」。
           競技レシピで水が語られるのはこれが理由なので、数字の読み方を置く。
           SCA の基準値は出典が複数一致しているものだけを載せている。 */
        <div style={{ marginTop: 10, padding: "14px 16px", border: `1px solid ${LINE}`, borderRadius: 12 }}>
          <div style={{ fontSize: FS.body, fontWeight: 800, color: INK }}>水のこと</div>
          <p style={{ fontSize: FS.body, color: GRAY, lineHeight: 1.9, margin: "8px 0 0" }}>
            <strong style={{ color: INK }}>硬度</strong>は、水に溶けているカルシウムとマグネシウムの量です。
            この2つが香りの成分を引き出すので、少なすぎると薄く平坦になり、多すぎると重く濁ります。
            大会では自分で用意した水を持ち込めるため、優勝者は組成まで作り込んでいます。
          </p>
          <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 10 }}>
            <tbody>
              {[
                ["総硬度", "50〜175 ppm", "カルシウム＋マグネシウム（CaCO₃換算）"],
                ["総溶解物 TDS", "75〜250 ppm", "目安は150。全部のミネラルの合計"],
                ["アルカリ度", "40〜75 ppm", "酸を打ち消す力。高いと酸が丸くなりすぎる"],
                ["pH", "6.5〜7.5", ""],
              ].map(([k, v, note]) => (
                <tr key={k} style={{ borderTop: `1px solid ${LINE}` }}>
                  <td style={{ padding: "7px 0", fontSize: FS.meta, color: GRAY, width: 96, verticalAlign: "top" }}>{k}</td>
                  <td style={{ padding: "7px 0", verticalAlign: "top" }}>
                    <span style={{ fontFamily: MONO, fontSize: FS.body, fontWeight: 700, color: INK }}>{v}</span>
                    {note && <span style={{ display: "block", fontSize: FS.meta, color: GRAY, marginTop: 2, lineHeight: 1.6 }}>{note}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p style={{ fontSize: FS.meta, color: GRAY, lineHeight: 1.8, margin: "10px 0 0" }}>
            上の数値は SCA（Specialty Coffee Association）の推奨範囲です。
            日本の水道水はおおむね総硬度 50〜100ppm で、この範囲に収まります。
            硬度の数字が「情報準備中」の回は、本人が公開していないものです。推測では書きません。
          </p>
        </div>
      )}

      <div style={{ marginTop: 18, borderBottom: `1px solid ${LINE}` }}>
        {RECIPES.map((r, i) => (
          <Row key={i} r={r} open={open === i} onToggle={() => setOpen(open === i ? -1 : i)} />
        ))}
      </div>

      <div style={{ marginTop: 18, fontSize: FS.meta, color: GRAY, lineHeight: 1.8 }}>
        ※ 2020年は新型コロナのため中止。数値・豆情報は大会レポートや本人インタビューなどの
        公開情報に基づきます。裏の取れなかった項目は埋めずに「情報準備中」と表示しています。
      </div>
    </div>
  );
}
