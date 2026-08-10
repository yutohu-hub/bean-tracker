/* 100gあたりの値段の両端を見て、図鑑に紛れ込んだ「豆でないもの」を探す。
 *
 *   node scripts/price_outliers.mjs            上下20件ずつ
 *   node scripts/price_outliers.mjs 60         上下60件ずつ
 *
 * ■ なぜ値段で探すのか
 *
 * 「豆でないもの」を落とす一覧（components/lib/isCoffee.js）は語で書いてある。
 * 店は世界中にあるので、語の一覧が全部の言語をおおうことは無い。
 * 実際、英語と日本語だけで書かれていた時期には、台湾の店のドリッパー(濾杯)や
 * カプセル(膠囊)がそのまま豆として並んでいた。
 *
 * 値段なら言語に関係なく効く。エスプレッソマシンは 100gあたり ¥40万、
 * 決済用の商品ページは ¥1 になるので、並べれば端に固まって出てくる。
 *
 * ■ 値段で「落とす」ことはしない
 *
 * 判定には使えない。香港やフィリピンには ¥170/100g の本物の豆があり、
 * オークションロットには $3,600/100g の本物がある。線を引くとどちらかを殺す。
 * ここは探すだけ。落とすかどうかは中身を見て、isCoffee.js に語で書く。
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const F = join(here, "..", "frontend", "components");
const { isCoffeeBean, isWholesale } = await import(join(F, "lib", "isCoffee.js"));
const { per100JPY } = await import(join(F, "lib", "currency.js"));

const n = Math.max(1, Number(process.argv[2]) || 20);
const data = JSON.parse(readFileSync(join(F, "data", "live.generated.json"), "utf8"));

// いま買えて、値段の付いているものだけ。並び順に効くのはこれ
const rows = data.beans
  .filter((b) => isCoffeeBean(b) && !isWholesale(b) && b.status === "now" && Number(b.amount) > 0)
  .map((b) => ({ b, p: per100JPY(b) }))
  .filter((x) => Number.isFinite(x.p) && x.p > 0)
  .sort((a, c) => a.p - c.p);

const at = (f) => Math.round(rows[Math.floor(rows.length * f)].p);
console.log(`いま買える豆 ${rows.length} 件`);
console.log(`100gあたり  下位5% ¥${at(0.05)}  /  中央 ¥${at(0.5)}  /  上位5% ¥${at(0.95)}\n`);

const line = ({ b, p }) =>
  `  ¥${String(Math.round(p)).padStart(8)}  ${b.r.padEnd(16)} ${String(b.cur).padEnd(4)}`
  + `${String(b.amount).padStart(9)}/${String(b.per).padEnd(6)} ${b.name.slice(0, 46)}`;

console.log(`■ 安い方から ${n} 件 — 決済用の商品ページ・惣菜・カップの大きさが紛れやすい`);
rows.slice(0, n).forEach((r) => console.log(line(r)));
console.log(`\n■ 高い方から ${n} 件 — エスプレッソマシン・器具が紛れやすい`);
rows.slice(-n).reverse().forEach((r) => console.log(line(r)));

console.log("\n豆でないものを見つけたら、components/lib/isCoffee.js と");
console.log("scripts/build_frontend_data.py の両方に語を足し、tests/test_is_coffee.mjs にも入れてください。");
