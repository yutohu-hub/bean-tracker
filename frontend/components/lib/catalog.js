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

const ts = (b) => (b.updatedAt ? Date.parse(b.updatedAt) || 0 : 0);

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
  if (f.sortBy === "p100asc") return list.slice().sort((a, b) => per100JPY(a) - per100JPY(b));
  if (f.sortBy === "p100desc") return list.slice().sort((a, b) => per100JPY(b) - per100JPY(a));
  if (f.sortBy === "new") return list.slice().sort((a, b) => (ts(b) - ts(a)) || (b.id - a.id));
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
