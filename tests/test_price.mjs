/* 値段まわりが、分からないものを分かったふりで出さないことを確かめる。
 *
 *   node tests/test_price.mjs
 *
 * ■ なぜ要るのか
 *
 * 図鑑もレアロットも100gあたりの安い順に並ぶ。だから架空の100g単価が1つあると、
 * いちばん目立つ先頭を占領する。実際、内容量が読めなかった商品に 250g と
 * 書き込んでいたせいで、$6,500 の絵が「¥390,000/100g のコーヒー」になっていた。
 *
 * 分からないものは 0 を返し、表示も並べ替えも平均もそこを避ける、という約束を守る。
 */
import assert from "node:assert/strict";
import { perGrams, per100JPY, hasPer100 } from "../frontend/components/lib/currency.js";

let ng = 0;
const check = (title, fn) => {
  try { fn(); console.log(`✓ ${title}`); }
  catch (e) { console.log(`✗ ${title}\n    ${e.message.split("\n")[0]}`); ng++; }
};

const bean = (per, amount = 1000, cur = "JPY") => ({ per, amount, cur });

check("ふつうの袋は、そのまま100gあたりが出る", () => {
  assert.equal(perGrams(bean("250g")), 250);
  assert.equal(Math.round(per100JPY(bean("250g", 2500))), 1000);
  assert.equal(hasPer100(bean("250g", 2500)), true);
});

check("オンス表記もグラムに直す", () => {
  assert.equal(perGrams(bean("12oz")), 340);          // 12 * 28.35
  assert.equal(hasPer100(bean("12oz", 3400)), true);
});

check("内容量が取れていない豆は、100gあたりを出さない", () => {
  for (const per of ["", null, undefined, "g", "0g", "不明"]) {
    assert.equal(perGrams(bean(per)), 0, `per=${JSON.stringify(per)}`);
    assert.equal(per100JPY(bean(per)), 0, `per=${JSON.stringify(per)}`);
    assert.equal(hasPer100(bean(per)), false, `per=${JSON.stringify(per)}`);
  }
});

check("値段が取れていない豆も、100gあたりを出さない", () => {
  assert.equal(per100JPY(bean("250g", 0)), 0);
  assert.equal(hasPer100(bean("250g", 0)), false);
});

check("0 は「安い」ではなく「分からない」。安い順の先頭に来てはいけない", () => {
  // catalog.js と同じ考え方。分かるものを先に、分からないものを末尾に
  const rows = [bean("", 6500), bean("250g", 2500), bean("250g", 800)];
  const sorted = rows.slice().sort((a, b) => {
    const oa = hasPer100(a), ob = hasPer100(b);
    if (oa !== ob) return oa ? -1 : 1;
    return per100JPY(a) - per100JPY(b);
  });
  assert.equal(sorted[0].amount, 800, "いちばん安い豆が先頭に来ていない");
  assert.equal(hasPer100(sorted[2]), false, "分からないものが末尾に来ていない");
});

if (ng) { console.log(`\n★ ${ng} 件おかしい。`); process.exit(1); }
console.log("\n値段の扱いは、すべて期待どおり。");
