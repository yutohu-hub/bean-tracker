/* 昔の豆番号で残っている記録を、いまの番号に付け替える処理を確かめる。
 *
 * ここは人の記録を書き替える。間違えると、評価やメモが別の豆に付く。
 * 元々そうなっていたのを直すための処理なので、直し方でまた壊しては意味がない。
 */
import { planRelink, isLegacyId } from "../frontend/components/lib/relink.js";

let bad = 0;
const check = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`  ✗ ${label}\n      ${w} のはずが ${g}`); bad++; }
  else console.log(`  ✓ ${label}`);
};

// いまの図鑑（番号は key から作るので10億以上）
const beans = [
  { id: 2020077693920, name: "Ethiopia Guji Natural", roasterName: "Onibus Coffee" },
  { id: 3007400960121, name: "Kenya Karatina AA", roasterName: "The Barn" },
  { id: 3844799830686, name: "House Blend", roasterName: "Fuglen" },
  // 同じ名前が2つの店にある。店名まで見ないと決められない
  { id: 4100000000001, name: "Morning Sun", roasterName: "A Roasters" },
  { id: 4100000000002, name: "Morning Sun", roasterName: "B Roasters" },
];

console.log("■ 昔の番号かどうかの判定");
check("昔の番号（上から順に振っていた範囲）", isLegacyId(100523), true);
check("いまの番号は付け替えない", isLegacyId(2020077693920), false);
check("手で確認した種の豆は触らない", isLegacyId(42), false);
check("手で足した記録（負の番号）は触らない", isLegacyId(-1765432100000), false);

console.log("\n■ 付け替え先の決め方");
check("豆名と店名が一致すれば付け替える",
  planRelink([{ beanId: 100001, name: "Ethiopia Guji Natural", roaster: "Onibus Coffee" }], beans),
  [{ from: 100001, to: 2020077693920 }]);

check("表記ゆれ（空白・記号）があっても見つける",
  planRelink([{ beanId: 100002, name: "kenya  karatina-aa", roaster: "The Barn" }], beans),
  [{ from: 100002, to: 3007400960121 }]);

check("店名が変わっていても、その名前が図鑑で1件だけなら付け替える",
  planRelink([{ beanId: 100003, name: "House Blend", roaster: "昔の店名" }], beans),
  [{ from: 100003, to: 3844799830686 }]);

// ここを間違えると、A店の記録がB店の豆に付く
check("同じ名前が複数の店にあるとき、店名が合わなければ何もしない",
  planRelink([{ beanId: 100004, name: "Morning Sun", roaster: "知らない店" }], beans), []);

check("同じ名前が複数あっても、店名が合えば付け替える",
  planRelink([{ beanId: 100005, name: "Morning Sun", roaster: "B Roasters" }], beans),
  [{ from: 100005, to: 4100000000002 }]);

check("図鑑に無い豆は触らない（記録は消さない）",
  planRelink([{ beanId: 100006, name: "もう売っていない豆", roaster: "どこか" }], beans), []);

check("いまの番号の記録は何もしない",
  planRelink([{ beanId: 2020077693920, name: "Ethiopia Guji Natural", roaster: "Onibus Coffee" }], beans), []);

console.log("\n■ 重ならないこと");
// 2つの記録が同じ豆に寄ると、あとから書いた方が前の記録を上書きしてしまう
check("2つの昔の記録が同じ豆を指しても、片方しか付け替えない",
  planRelink([
    { beanId: 100010, name: "Ethiopia Guji Natural", roaster: "Onibus Coffee" },
    { beanId: 100011, name: "Ethiopia Guji Natural", roaster: "Onibus Coffee" },
  ], beans),
  [{ from: 100010, to: 2020077693920 }]);

check("行き先が、すでに別の記録で使われている番号なら付け替えない",
  planRelink([
    { beanId: 2020077693920, name: "Ethiopia Guji Natural", roaster: "Onibus Coffee" },
    { beanId: 100012, name: "Ethiopia Guji Natural", roaster: "Onibus Coffee" },
  ], beans), []);

console.log("\n■ 壊れた入力で落ちないこと");
check("記録が空", planRelink([], beans), []);
check("図鑑が空", planRelink([{ beanId: 100001, name: "x", roaster: "y" }], []), []);
check("名前が無い記録", planRelink([{ beanId: 100001, name: "", roaster: "y" }], beans), []);
check("null を渡しても落ちない", planRelink(null, null), []);

console.log(bad ? `\n${bad}件の食い違い` : "\n付け替えの決め方は、すべて期待どおり。");
process.exit(bad ? 1 : 0);
