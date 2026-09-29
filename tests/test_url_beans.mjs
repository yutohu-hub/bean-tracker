/* 「好きな豆をまとめて送る」リンクの、URLの読み書きを確かめる。
 *
 * ここが崩れると、送ったリンクが別の豆を開いたり、何も開かなくなったりする。
 * 相手の手元で起きるので、送った側は気づけない。
 */

// urlState.js は window を触るので、読み込む前に最低限の窓を用意する
global.window = {
  location: { origin: "https://example.com", pathname: "/bean-tracker/", search: "", hash: "" },
  history: { pushState() {}, replaceState() {} },
  addEventListener() {}, removeEventListener() {},
};

const { readUrlState, shareUrl, MAX_SHARED_BEANS } =
  await import("../frontend/components/lib/urlState.js");

let bad = 0;
const check = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`  ✗ ${label}\n      ${w} のはずが ${g}`); bad++; }
  else console.log(`  ✓ ${label}`);
};
const read = (search) => { window.location.search = search; return readUrlState(); };

console.log("■ 送る側（状態 → URL）");
check("豆の番号を並べて載せる",
  shareUrl({ beanIds: [2020077693920, 3007400960121] }),
  "https://example.com/bean-tracker/?bs=2020077693920%2C3007400960121");
check("空のときは何も付けない", shareUrl({ beanIds: [] }), "https://example.com/bean-tracker/");
check("上限を超えたら切る",
  shareUrl({ beanIds: Array.from({ length: MAX_SHARED_BEANS + 10 }, (_, i) => i + 1) })
    .split("bs=")[1].split("%2C").length,
  MAX_SHARED_BEANS);

console.log("\n■ 受け取る側（URL → 状態）");
check("並びをそのまま読む", read("?bs=3,1,2").beanIds, [3, 1, 2]);
check("何も付いていなければ空", read("").beanIds, []);
check("他の指定と混ぜても読める", read("?v=zukan&bs=5,6").beanIds, [5, 6]);

console.log("\n■ 壊れたURLで落ちないこと");
// 人が手で触ったURLや、アプリの都合で切れたURLが来る
check("数字でないものは捨てる", read("?bs=abc,12,,x").beanIds, [12]);
check("負の番号は捨てる（手で足した記録の番号）", read("?bs=-5,7").beanIds, [7]);
check("0は捨てる", read("?bs=0,9").beanIds, [9]);
check("同じ番号は1つにまとめる", read("?bs=4,4,4").beanIds, [4]);
check("全部おかしければ空", read("?bs=abc").beanIds, []);
check("上限より多く来ても切る",
  read(`?bs=${Array.from({ length: MAX_SHARED_BEANS + 50 }, (_, i) => i + 1).join(",")}`).beanIds.length,
  MAX_SHARED_BEANS);

console.log("\n■ 送って受け取ると同じに戻ること");
const ids = [2020077693920, 3007400960121, 3844799830686];
const q = shareUrl({ beanIds: ids }).split("?")[1];
check("往復して並びまで一致", read(`?${q}`).beanIds, ids);

console.log(bad ? `\n${bad}件の食い違い` : "\nまとめリンクのURLは、すべて期待どおり。");
process.exit(bad ? 1 : 0);
