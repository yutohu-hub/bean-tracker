// 図鑑の「絞り込み・並び替え・ページ割り」。
//
// これらは画面の見た目とは関係のない計算なのに、BeanTracker.jsx の中に
// JSX と混ざって置かれていた。同じファイルに 600 行あると、条件を1つ足すたびに
// 描画のどこに影響するのかを読み直すことになる。計算だけをここに集める。

import { toJPY, per100JPY } from "./currency";
import { processKey } from "./palette";

// 価格帯。表示する文字は通貨で変わるが、判定そのものは常に円で行う
// （国ごとに違う通貨のまま比べると、同じ帯に入る豆が変わってしまう）。
export const PRICE_BANDS = {
  all: { jp: "すべての価格", en: "All prices", test: () => true },
  low: { jp: "〜¥2,000", en: "〜$13", test: (jpy) => jpy < 2000 },
  mid: { jp: "¥2,000〜3,000", en: "$13〜20", test: (jpy) => jpy >= 2000 && jpy < 3000 },
  high: { jp: "¥3,000〜", en: "$20〜", test: (jpy) => jpy >= 3000 },
};

export const PROCESSES = ["すべて", "Washed", "Natural", "Honey", "Anaerobic Natural", "Anaerobic Washed"];

export const priceBandLabel = (key, cur) =>
  cur === "JPY" ? PRICE_BANDS[key].jp : PRICE_BANDS[key].en;

// 図鑑に入った日。取れていないものは 0 になる
const ts = (b) => (b.updatedAt ? Date.parse(b.updatedAt) || 0 : 0);

/* 日付の並べ替え。dir=-1 で新しい順、dir=1 で古い順。
   日付が取れていない豆は、どちらの向きでも末尾へ送る。
   古い順のときに素直に昇順にすると、日付の無いものが 0 として先頭に居座り、
   いちばん目立つ場所が「日付が分からない豆」で埋まる。 */
const byDate = (dir) => (a, b) => {
  const ta = ts(a), tb = ts(b);
  if (!ta !== !tb) return ta ? -1 : 1;      // 日付なしは後ろ
  return (ta - tb) * dir || (a.id - b.id) * dir;
};

/* 100gあたりの値段として、ありえる範囲。
   ECの表記から値段と内容量を読み取る過程で取り違えが起きる。並び替えを入れて
   実際に端から見たところ、両端はほぼ取り違えだった。

     ¥2,607,000/100g   1185 DKK / 1g      内容量を 1g と読んでいる
     ¥1,074,304/100g   23980 SGD / 250g   エスプレッソマシン
     ¥1/100g           2 INR / 250g       送料保険の行

   下限 ¥100/100g（¥1,000/kg）は生豆の相場を下回る。
   上限 ¥150,000/100g は競売の世界記録に並ぶ額（およそ $1,000/100g）。
   どちらも店頭の値段としては成立しないので、取れなかったものと同じ扱いにする。

   上限に引っかかるものの中身も見た。エスプレッソマシンのほかに、ある1店
   （apollonsgold・24銘柄）が値段をセント単位のまま出していて、実勢の約100倍に
   なっている（中央値 ¥405,000/100g。全体の中央値は ¥1,113）。
   これは巡回側の取り違えなので、本来はそちらで直すべきもの。

   消しはしない。本物の高額ロットを巻き込む恐れがあるのと、値段以外は
   正しい豆もあるため。並びの末尾へ送るだけにとどめる。 */
const P_MIN = 100, P_MAX = 150000;
const priced = (b) => { const p = per100JPY(b); return p >= P_MIN && p <= P_MAX; };

/* 値段の並べ替え。dir=1 で安い順、dir=-1 で高い順。
   値段が読めなかった豆は、どちらの向きでも末尾へ送る。
   安い順の先頭が「¥1」で埋まると、いちばん安い豆を探せない。 */
const byPrice = (dir) => (a, b) => {
  const oka = priced(a), okb = priced(b);
  if (oka !== okb) return oka ? -1 : 1;
  return (per100JPY(a) - per100JPY(b)) * dir || a.id - b.id;
};

/* 図鑑に並ぶ豆。ECサイトのあるロースターの豆だけを対象にする
   （送客が目的なので、買いに行けない豆を並べても意味がない）。

   国での絞り込みは検索語で行う。以前は country という専用の条件があったが、
   それを変える手立てが画面に無く、常に "all" のまま素通りしていた。
   条件だけ残すと「効いているように読める死んだ分岐」になるので、
   検索語が国名にも当たるようにして一本化した。 */
export function filterBeans(beans, roasters, f) {
  const q = (f.query || "").trim().toLowerCase();
  const list = beans.filter((b) => {
    const r = roasters[b.r];
    return (r && r.url) &&
      (f.origin === "すべて" || b.origin === f.origin) &&
      (f.status === "all" ? b.status !== "sold" : b.status === f.status) &&
      (f.process === "すべて" || processKey(b.process) === processKey(f.process)) &&
      PRICE_BANDS[f.price].test(toJPY(b)) &&
      (!q || b.name.toLowerCase().includes(q) || r.name.toLowerCase().includes(q)
        || (b.origin || "").toLowerCase().includes(q)
        || (r.country || "").toLowerCase().includes(q));
  });
  // 値段が取れていない豆（0円）は、安い順の先頭を占めないよう末尾へ送る
  if (f.sortBy === "p100asc") return list.slice().sort(byPrice(1));
  if (f.sortBy === "p100desc") return list.slice().sort(byPrice(-1));
  if (f.sortBy === "new") return list.slice().sort(byDate(-1));
  if (f.sortBy === "old") return list.slice().sort(byDate(1));
  return list;
}

// ロースターごとの NOW 在庫数。一覧の並び順に使う
export function countNowByRoaster(beans) {
  const m = {};
  for (const b of beans) if (b.status === "now") m[b.r] = (m[b.r] || 0) + 1;
  return m;
}

// ロースター一覧。在庫の多い順 → 名前順
export function filterRoasters(roasters, nowCount, f) {
  const q = (f.query || "").trim().toLowerCase();
  return Object.entries(roasters)
    .filter(([, r]) =>
      (!q || r.name.toLowerCase().includes(q) || (r.city || "").toLowerCase().includes(q)
        || (r.country || "").toLowerCase().includes(q)))
    .sort((a, b) => (nowCount[b[0]] || 0) - (nowCount[a[0]] || 0)
      || a[1].name.localeCompare(b[1].name));
}

// ページャに出す番号（先頭・末尾・現在の前後＋省略記号）
export function pageWindow(cur, total) {
  const out = [];
  let last = -1;
  for (let p = 0; p < total; p++) {
    if (p === 0 || p === total - 1 || (p >= cur - 1 && p <= cur + 1)) {
      if (last >= 0 && p - last > 1) out.push("…");
      out.push(p);
      last = p;
    }
  }
  return out;
}
