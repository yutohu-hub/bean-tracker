/* 手で書いた店の情報に、巡回のデータを重ねる処理を確かめる。
 *
 * ここを間違えると、被害の出方が2通りある。
 *
 *   重ね方が浅すぎる … 巡回が集めた欄が図鑑に出ない。
 *                      実測: Instagram を318店ぶん集めたのに、出たのは9店だけだった。
 *   重ね方が強すぎる … 手で書いた街・座標・紹介文が消える。
 *                      過去に、店の位置が国の中心や大西洋へ飛んだことがある。
 *
 * どちらも画面を見ただけでは気づきにくいので、両方を残す。
 */
import { mergeOverlay } from "../frontend/components/lib/mergeOverlay.js";

let bad = 0;
const check = (label, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  if (g !== w) { console.log(`  ✗ ${label}\n      ${w} のはずが ${g}`); bad++; }
  else console.log(`  ✓ ${label}`);
};

const seeded = {
  onyx: { name: "Onyx Coffee Lab", city: "Rogers", coord: [-94.1, 36.3], bio: "手で書いた紹介文" },
  sey: { name: "Sey Coffee", city: "Brooklyn", coord: [-73.9, 40.7], bio: "こちらも手書き" },
};

// --- 種にある店へ、欄を1つだけ足す（Instagram のとき） ---
const a = mergeOverlay(seeded, { onyx: { instagram: "onyxcoffeelab" } });
check("欄が足される", a.onyx.instagram, "onyxcoffeelab");
check("手で書いた街は残る", a.onyx.city, "Rogers");
check("手で書いた座標は残る", a.onyx.coord, [-94.1, 36.3]);
check("手で書いた紹介文は残る", a.onyx.bio, "手で書いた紹介文");
check("名前も残る", a.onyx.name, "Onyx Coffee Lab");
check("触っていない店は無事", a.sey.city, "Brooklyn");

// --- 巡回で見つけた新しい店は、そのまま入る ---
const b = mergeOverlay(seeded, {
  zzz: { name: "Zzz Roastery", city: "Osaka", coord: [135.5, 34.7] },
});
check("新しい店が増える", b.zzz.name, "Zzz Roastery");
check("種の店は減らない", Object.keys(b).sort(), ["onyx", "sey", "zzz"]);

// --- 同じ欄があれば巡回側が勝つ（実データの方が新しい） ---
const c = mergeOverlay(seeded, { onyx: { city: "Fayetteville" } });
check("同じ欄は巡回側が勝つ", c.onyx.city, "Fayetteville");
check("勝っても他の欄は消えない", c.onyx.bio, "手で書いた紹介文");

// --- 元の物を書き換えない（呼び出し側が持っている表が壊れると原因を追いにくい） ---
mergeOverlay(seeded, { onyx: { instagram: "x_handle" } });
check("元の表は変わらない", seeded.onyx.instagram, undefined);

// --- 空でも落ちない ---
check("重ねるものが無くてもよい", Object.keys(mergeOverlay(seeded, {})).sort(), ["onyx", "sey"]);
check("種が空でもよい", mergeOverlay({}, { a: { name: "A" } }).a.name, "A");
check("両方 undefined でも落ちない", mergeOverlay(undefined, undefined), {});

if (bad) { console.log(`\n${bad}件の食い違い`); process.exit(1); }
console.log("\n店の情報の重ね方: すべて期待どおり");
