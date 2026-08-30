// 味わいマップの系統定義と座標
export const FLAVORS = {
  citrus: { label: "柑橘", color: "#D9B441" },
  floral: { label: "花・お茶", color: "#D98CA6" },
  berry: { label: "ベリー", color: "#7C4D8F" },
  tropical: { label: "トロピカル", color: "#D97E3A" },
  choco: { label: "チョコ・甘み", color: "#7A5232" },
};
/* fx: 0=クリーン ←→ 100=個性派 / fy: 0=明るい ←→ 100=深い */
export const FLAVOR_MAP = {
  67: { fx: 60, fy: 10, fam: "floral", notes: "ジャスミン・ラベンダー・杏" },

};

/* ECサイト由来の「豆ごとの味の特徴」（豆名やノートに書かれた風味の言葉）から系統を分類する。
   該当するキーワードがあればその系統を優先し、無ければ産地・精製から推定する。
   優先順は、より個性を決定づける風味（ベリー/トロピカル/花・お茶/柑橘/チョコ）の順。
   fyB: 明るい(−)↔深い(+) の微調整、fxB: クリーン(−)↔個性派(+) の微調整。 */
/* 系統ごとの語彙。各語は「その系統らしさ」の点として数える。
   fy/fx は、その系統がどれだけ「深い」「個性的」側かの重み。
   最初に当たった1つで決めていた頃は配列の順序が結果を左右し、
   "Blackcurrant and Acerola with Hibiscus Tea" が Tea に負けてお茶になっていた。 */
const FLAVOR_VOCAB = [
  ["berry",    -6,  10, /ベリー|苺|いちご|ストロベリー|ラズベリー|ブルーベリー|カシス|クランベリー|赤い果実|レッドフルーツ|プラム|チェリー|さくらんぼ|アセロラ|ハイビスカス|レーズン|干しぶどう|イチジク|red\s*fruit|berr|cassis|currant|cherry|plum|acerola|hibiscus|rhubarb|raisin|fig\b|date\b|pomegranate/gi],
  ["tropical",  0,  14, /トロピカル|パイナップル|マンゴー|ライチ|パッション|パパイヤ|グァバ|グアバ|メロン|マスカット|白ぶどう|ピーチ|白桃|杏|アプリコット|スターフルーツ|バナナ|tropical|pineapple|mango|lychee|passion|guava|papaya|melon|muscat|peach|apricot|starfruit|banana|nectarine/gi],
  ["floral",  -10,  -4, /フローラル|花|ジャスミン|ローズ|薔薇|バラ|紅茶|ティー|ベルガモット|アールグレイ|オレンジフラワー|カモミール|ラベンダー|すみれ|バイオレット|レモングラス|ハーブ|floral|jasmine|rose\b|blossom|tea\b|bergamot|earl\s*grey|lavender|chamomile|violet|lemongrass|herbal|citronella/gi],
  ["citrus",   -8,  -6, /柑橘|シトラス|レモン|ライム|オレンジ|グレープフルーツ|マンダリン|みかん|ゆず|すだち|グレフル|青りんご|青リンゴ|リンゴ酸|citrus|lemon|lime|orange|grapefruit|mandarin|yuzu|clementine|tangerine|green\s*apple|crisp/gi],
  ["choco",    14,  -2, /チョコ|カカオ|ココア|ナッツ|アーモンド|ヘーゼル|クルミ|キャラメル|ブラウンシュガー|黒糖|きび砂糖|蜂蜜|はちみつ|バニラ|モルト|麦芽|スパイス|シナモン|クローブ|香ばし|ロースト|トフィー|糖蜜|ヌガー|chocolate|cocoa|cacao|nut|almond|hazelnut|walnut|caramel|toffee|brown\s*sugar|molasses|honey|vanilla|malt|spice|cinnamon|nougat|cane\s*sugar|praline|fudge/gi],
];

/* 発酵・実験系の語は「個性派」側へ強く寄せる（横軸の主成分）。
   店のノートに出る言葉で、精製名が書かれていない豆でも個性を拾えるようにする。 */
const FUNK_WORDS = /アナエロビック|嫌気|発酵|ファンキー|ワイン|カルバドス|ラム|洋酒|シナモン漬け|コーファーメント|anaerobic|ferment|co-?ferment|funky|boozy|wine|winey|rum|whisk|brandy|cider|kombucha|natto|savou?ry|umami/gi;

const FAMS = ["berry", "tropical", "floral", "citrus", "choco"];

/* テキストから系統ごとの点数を数える。各系統の語が何種類出たかを見る
   （同じ語の繰り返しでは増やさない）。 */
function scoreFlavors(text) {
  const s = { berry: 0, tropical: 0, floral: 0, citrus: 0, choco: 0 };
  if (!text) return s;
  for (const [fam, , , re] of FLAVOR_VOCAB) {
    const hits = new Set((text.match(re) || []).map((w) => w.toLowerCase()));
    s[fam] = hits.size;
  }
  return s;
}

/* 後方互換：最も点数の高い系統と、その重みを返す。点が無ければ null。 */
export function classifyFlavor(text = "") {
  const s = scoreFlavors(text);
  const top = FAMS.reduce((a, b) => (s[b] > s[a] ? b : a), "berry");
  if (!s[top]) return null;
  const v = FLAVOR_VOCAB.find((x) => x[0] === top);
  return { fam: top, fyB: v[1], fxB: v[2], score: s[top] };
}

/* 店が書いたノートから座標を作る。
   系統をひとつに丸めず、点数を重みにした加重平均で位置を決めるので、
   「ベリー寄りだが少し花もある」豆と「ベリーだけ」の豆が別の場所に来る。
   ノートが無ければ null を返し、呼び出し側が産地・精製の推定に落とす。 */
export function flavorFromNotes(text) {
  const s = scoreFlavors(text);
  const total = FAMS.reduce((n, f) => n + s[f], 0);
  if (!total) return null;
  let fy = 0, fx = 0;
  for (const [fam, fyB, fxB] of FLAVOR_VOCAB) {
    if (!s[fam]) continue;
    fy += fyB * s[fam];
    fx += fxB * s[fam];
  }
  fy /= total; fx /= total;
  // 発酵・実験の語があれば横軸をさらに個性派側へ
  const funk = new Set((String(text).match(FUNK_WORDS) || []).map((w) => w.toLowerCase())).size;
  const fam = FAMS.reduce((a, b) => (s[b] > s[a] ? b : a), "berry");
  return {
    // 中心(50,50)から語彙の重みぶん動かす。語数が多いほど輪郭がはっきりするので係数を強める
    fx: 50 + fx * 2.2 + Math.min(3, funk) * 9,
    fy: 50 + fy * 2.2,
    fam,
    score: total,
    spread: FAMS.filter((f) => s[f]).length,   // いくつの系統に跨っているか
  };
}

export function computeFlavor(b) {
  /* 店が書いたノートがあれば、それだけで座標を決める。
     産地と精製からの推定は「ノートが無い豆」の代役に降格させた。
     推定だけだと入力が2種類しかなく、1362件が43通りの座標に固まって
     819件が同じ1点に重なっていたため。 */
  const byNotes = b.notes ? flavorFromNotes(`${b.name || ""} ${b.notes}`) : null;
  if (byNotes) {
    // 跨る系統が少ない（＝輪郭が明確な）豆ほどブレを小さくする
    const amp = byNotes.spread >= 3 ? 0.5 : 0.25;
    const jx = (((b.id * 53) % 21) - 10) * amp, jy = (((b.id * 97) % 21) - 10) * amp;
    return {
      fx: Math.max(4, Math.min(96, byNotes.fx + jx)),
      fy: Math.max(4, Math.min(96, byNotes.fy + jy)),
      fam: byNotes.fam,
      src: "notes",
      /* そのノートをどうやって取ったか。巡回が付ける（crawler の note_src）。
         "label" = 店が「Tasting Notes:」の見出しを付けている。
                   "Grape, Guava, Floral" のような列挙なので、語を数えれば座標が決まる。
         "guess" = 見出しが無く、風味語が2つ以上ある行から拾った。
                   "A comforting and sweet coffee with flavours of chocolate" のような
                   地の文が混ざる。間違ってはいないが、語の密度が低く座標がぶれる。
         味わいマップはこれを見て、確かな方だけに絞れるようにしている。 */
      noteSrc: b.noteSrc || "",
    };
  }
  const proc = b.process || "", o = b.origin || "";
  let fx = 30;
  if (/Anaerobic/i.test(proc)) fx = 84;
  else if (/Natural/i.test(proc)) fx = 66;
  else if (/Honey/i.test(proc)) fx = 54;
  else if (/Washed/i.test(proc)) fx = 30;
  let fy = 48;
  if (/エチオピア|ケニア|ルワンダ|ブルンジ|タンザニア/.test(o)) fy = 24;
  else if (/コロンビア|グアテマラ|コスタリカ|パナマ/.test(o)) fy = 42;
  else if (/ペルー|メキシコ/.test(o)) fy = 55;
  else if (/ブラジル|インドネシア|インド|ベトナム|中国/.test(o)) fy = 72;
  else if (/ブレンド/.test(o)) fy = 62;
  let fam;
  if (/エチオピア/.test(o)) fam = /Natural|Anaerobic/i.test(proc) ? "berry" : "floral";
  else if (/ケニア|タンザニア/.test(o)) fam = "berry";
  else if (/コロンビア|グアテマラ|コスタリカ|パナマ|ペルー/.test(o)) fam = "citrus";
  else if (/ブラジル|メキシコ|インドネシア|インド|ベトナム|中国/.test(o)) fam = "choco";
  else if (/Natural|Anaerobic/i.test(proc)) fam = "tropical";
  else fam = "citrus";
  // ノートは上で処理済み。ここでは銘柄名に風味語があればそれだけ反映する
  const byName = classifyFlavor(b.name || "");
  if (byName) { fam = byName.fam; fx += byName.fxB; fy += byName.fyB; }
  const jx = ((b.id * 53) % 21) - 10, jy = ((b.id * 97) % 21) - 10; // -10..10
  return { fx: Math.max(4, Math.min(96, fx + jx * 0.9)), fy: Math.max(4, Math.min(96, fy + jy * 0.9)), fam, src: "guess" };
}

/* 味わいマップの座標をどこから取るか、順番をここ1か所に決める。
   1. 店が書いたノート（実データ）
   2. 手書きの FLAVOR_MAP（ノートが無い時代に人手で置いた値）
   3. 産地と精製からの推定（最後の代役）
   以前は 2 が 1 より優先だったため、ノートを取れた豆でも古い手書き値が使われていた。 */
export function flavorOf(bean) {
  if (!bean) return null;
  if (bean.notes) {
    const m = computeFlavor(bean);
    if (m.src === "notes") return m;
  }
  return FLAVOR_MAP[bean.id] || computeFlavor(bean);
}
