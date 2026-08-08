/* 店の性格を、その店がいま並べている豆から数える。
 *
 * ■ なぜ作ったか
 *
 * 診断はこれまで、店の紹介文（style / focus）に特定の語が入っているかで
 * 相性を測っていた。「エチオピア」の3文字があれば africa=1、無ければ 0。
 * これだと紹介文の書き方の差が全部で、実際に何を売っているかは見ていない。
 *
 * 実測すると壊れ方がはっきり出た。回答の組み合わせは 288 通りあるのに、
 *
 *   1位になれる店      12 店（いま買える 268 店のうち）
 *   上位5に入れる店     39 店（14.6%）
 *   「中南米・バランス」と答えたとき、147 店が小数点まで同じ点で1位タイ
 *
 * 229 店は、どう答えても永久に画面に出てこない。並び順は Object.keys の順で
 * 決まっていた。しかも clean は全店 0.6 の定数で、「クリーンな Washed が基本」
 * という選択肢は順位に何の影響も与えていなかった。
 *
 * ■ 代わりに何を使うか
 *
 * 豆のデータは 6,025 点あり、産地と精製は 100% 埋まっている。
 * 「この店の在庫のうちアフリカ産が何割か」は、紹介文より確かな事実。
 * 割合は連続値なので、同点の山も自然にほどける。
 *
 * ■ 在庫の少ない店をどう扱うか
 *
 * 割合をそのまま使うと、エチオピア1点だけ置いている店が「アフリカ100%」に
 * なって、40点中26点がアフリカの店に勝ってしまう。全体の割合の側へ
 * 引き寄せる（PRIOR 点ぶんの「ふつうの店」を混ぜてから割る）。
 * 在庫の中央値は19点なので、PRIOR=8 は「19点あればほぼ自分の値、
 * 3点なら全体寄り」という効き方になる。
 *
 * ■ 焙煎度だけは豆から出せない
 *
 * roast の欄は全 6,025 点が空。浅煎り/中煎りの好みは、店の紹介文から
 * 読むしかない。ここだけは以前のままで、他より弱い手がかりだと承知して使う。
 */
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";
import { per100JPY } from "./currency";
import { ORIGIN_GROUP } from "./originGroup";

const PRIOR = 8;                     // 収縮の強さ（「ふつうの店」を何点ぶん混ぜるか）
const P_MIN = 100, P_MAX = 150000;   // 100gあたりの円で、明らかな異常値を落とす帯

/* 割合として数える特徴。ここに挙げたものは在庫から出す。 */
const SHARE = ["africa", "latam", "asia", "clean", "natural", "experimental", "geisha"];
/* 紹介文から出す特徴（豆に対応するデータが無いもの）。 */
const TEXT = ["light", "medium", "domestic"];
export const FEATURES = [...SHARE, ...TEXT, "budget"];

const med = (a) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; };

/* 1店ぶんの数え上げ。分母が2種類あることに注意する。
   産地はブレンド（2,822点）に産地が無いので、産地の判る豆だけを分母にする。
   精製は全点に入っているので、在庫全体を分母にする。 */
function tally(beans) {
  const groups = beans.map((b) => ORIGIN_GROUP(b.origin)).filter(Boolean);
  const p = (re) => beans.filter((b) => re.test(b.process || "")).length;
  const prices = beans.map(per100JPY).filter((v) => v >= P_MIN && v <= P_MAX);
  return {
    n: beans.length,
    nOrigin: groups.length,
    africa: groups.filter((g) => g === "africa").length,
    latam: groups.filter((g) => g === "latam").length,
    asia: groups.filter((g) => g === "asia").length,
    // Anaerobic Washed / Anaerobic Natural は実験側に数えたいので、素の数から引く
    clean: p(/Washed/i) - p(/Anaerobic\s*Washed/i),
    natural: p(/Natural|Honey/i) - p(/Anaerobic\s*Natural/i),
    experimental: p(/Anaerobic|Carbonic|Thermal|Yeast|Koji|Lactic/i),
    geisha: beans.filter((b) => b.vt === "geisha" || b.vt === "sidra").length,
    price: med(prices),
    nPrice: prices.length,
  };
}

/* 値段が信じられる店かどうかを、同じ通貨の他店と比べて決める。
 *
 * 巡回データには桁のずれた店が混ざっている。実測では
 * Apollon's Gold が同じ USD の店の 382倍、Kaveri が同じ INR の店の 0.02倍、
 * Original Coffee が同じ DKK の店の 0.17倍。原因は店ごとに違い（通貨の設定、
 * セント単位の価格、非コーヒー商品）、ここで直せるものではない。
 *
 * 直せないものを当てにしないほうを選ぶ。同通貨の中央値から3倍以上ずれた店は
 * 値段の軸では中立（全体の中央値と同じ）に置き、値段を理由に上にも下にも来ない。
 */
function priceTrust(byRoaster, tal, keys) {
  const cur = {};
  for (const k of keys) {
    const b = byRoaster[k][0];
    if (b) (cur[b.cur] = cur[b.cur] || []).push(k);
  }
  const ok = {};
  for (const ks of Object.values(cur)) {
    const peer = med(ks.map((k) => tal[k].price).filter(Boolean));
    for (const k of ks) {
      const m = tal[k].price;
      // 同通貨の店が2つ以下だと比べる相手がいないので、その時は信じる
      ok[k] = !m ? false : ks.length < 3 ? true : m >= peer / 3 && m <= peer * 3;
    }
  }
  return ok;
}

let cache = null;

export function roasterProfiles() {
  if (cache) return cache;

  const now = BEANS.filter((b) => b.status === "now" && ROASTERS[b.r]);
  const byRoaster = {};
  for (const b of now) (byRoaster[b.r] = byRoaster[b.r] || []).push(b);
  const keys = Object.keys(byRoaster);

  const tal = {};
  for (const k of keys) tal[k] = tally(byRoaster[k]);
  const all = tally(now);
  const trusted = priceTrust(byRoaster, tal, keys);

  // 全体の割合＝収縮の寄せ先
  const base = {};
  for (const f of ["africa", "latam", "asia"]) base[f] = all[f] / all.nOrigin;
  for (const f of ["clean", "natural", "experimental", "geisha"]) base[f] = all[f] / all.n;
  const basePrice = med(keys.filter((k) => trusted[k]).map((k) => tal[k].price));

  const feats = {};
  for (const k of keys) {
    const t = tal[k], f = {};
    for (const g of ["africa", "latam", "asia"]) f[g] = (t[g] + PRIOR * base[g]) / (t.nOrigin + PRIOR);
    for (const g of ["clean", "natural", "experimental", "geisha"]) f[g] = (t[g] + PRIOR * base[g]) / (t.n + PRIOR);
    // 安いほど高い値。倍・半分が同じ幅になるよう log で測る
    f.budget = trusted[k] ? -Math.log2(t.price / basePrice) : 0;

    const style = ROASTERS[k].style || "";
    f.light = /極浅/.test(style) ? 1 : /浅煎り/.test(style) ? (/中/.test(style) ? 0.7 : 0.9) : /中深|深/.test(style) ? 0 : 0.4;
    f.medium = /中浅|中煎り/.test(style) ? 1 : /浅〜中|浅\/中/.test(style) ? 0.7 : 0.4;
    /* 「国内」は日本にある店。以前は ship 欄に「国内発送」と書いてあるかで
       見ていたが、その欄はどの店も自国内の発送を指していて、39店のうち19店は
       インド・マレーシア・台湾・フィリピン・香港の店だった。「国内でさっと
       届いてほしい」と答えるとマニラやムンバイの店が並ぶ状態だった。
       所在国は全店に入っている確かな値なので、そちらで判定する。 */
    f.domestic = ROASTERS[k].country === "JP" ? 1 : 0;
    feats[k] = f;
  }

  /* 全部を平均0・ばらつき1に直す。
     割合（0〜1）と log の値と 0/1 のフラグが混ざったままだと、設問に付けた
     重み 2 や 1.5 が特徴ごとに違う意味になる。同じ物差しに乗せてから足す。
     信用できない値段を 0 にしてあるのはこの後の基準では「ちょうど平均」で、
     狙いどおり値段では順位が動かない。 */
  for (const f of FEATURES) {
    const v = keys.map((k) => feats[k][f]);
    const mu = v.reduce((a, b) => a + b, 0) / v.length;
    const sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / v.length) || 1;
    for (const k of keys) feats[k][f] = (feats[k][f] - mu) / sd;
  }

  cache = { keys, feats, tally: tal, base, basePrice, trusted };
  return cache;
}

/* 結果画面に出す「なぜこの店か」。数えた事実だけを短く返す。
   相性の理由が書けないなら、それは根拠が無いということなので何も書かない。 */
export function reasonFor(key, weights) {
  const { feats, tally: tal, trusted } = roasterProfiles();
  const t = tal[key], f = feats[key];
  if (!t) return "";
  const pct = (num, den) => (den ? Math.round((num / den) * 100) : 0);
  const cand = [
    ["africa", `アフリカ産が在庫の${pct(t.africa, t.nOrigin)}%`, t.nOrigin >= 4],
    ["latam", `中南米産が在庫の${pct(t.latam, t.nOrigin)}%`, t.nOrigin >= 4],
    ["asia", `アジア産が在庫の${pct(t.asia, t.nOrigin)}%`, t.nOrigin >= 4],
    ["natural", `Natural・Honey が${pct(t.natural, t.n)}%`, t.natural > 0],
    ["clean", `Washed が${pct(t.clean, t.n)}%`, t.clean > 0],
    ["experimental", `Anaerobic など${t.experimental}点`, t.experimental > 0],
    ["geisha", `ゲイシャ・シドラ${t.geisha}点`, t.geisha > 0],
    // 値段は全体の中央値より上でも出す。絞り込んだ中では安いことがあるので、
    // 「全体より安いか」ではなく、その店の実額をそのまま見せる
    ["budget", `100gあたり約${Math.round(t.price).toLocaleString()}円`, trusted[key] && t.price > 0],
  ];
  // その人の回答で重かった特徴のうち、この店が実際に平均より上のものを2つまで
  return cand
    .filter(([g, , ok]) => ok && (weights[g] || 0) > 0 && f[g] > 0.2)
    .sort((a, b) => (weights[b[0]] * feats[key][b[0]]) - (weights[a[0]] * feats[key][a[0]]))
    .slice(0, 2)
    .map(([, text]) => text)
    .join(" ・ ");
}
