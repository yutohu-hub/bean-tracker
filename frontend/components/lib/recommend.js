// 「この豆の次に飲むなら」を2つ選ぶ。
//
// 記録を書いたすぐ下に置く前提で作っている。飲み終えて評価を付けた直後は、
// 次に何を買うかを決めるのにいちばん都合のいい瞬間なので、そこで2方向に伸ばす。
//
//   同じ産地から … 産地を固定して、味わいの近いもの。同じ土地の別の表情を見る
//   似た味わい   … 産地は変えて、味の座標が近いもの。同じ味を別の土地で探す
//
// 2つで役割が違う。どちらも同じ豆を出してしまうと選択肢が1つに見えるので、
// 「似た味わい」側は産地が違うものからしか選ばない。

import { BEANS } from "../data/beans";
import { ROASTERS } from "../data/roasters";
import { flavorOf } from "../data/flavors";
import { per100JPY } from "./currency";

// 味の座標は豆名とノートを正規表現で読むので、そこそこ重い。
// 詳細シートを開くたびに 6,000 件分やり直さないよう、一度出したものは覚えておく。
const coordCache = new Map();
function coordOf(bean) {
  let c = coordCache.get(bean.id);
  if (!c) {
    const f = flavorOf(bean) || {};
    c = { fx: f.fx ?? 50, fy: f.fy ?? 50, fam: f.fam || "other" };
    coordCache.set(bean.id, c);
  }
  return c;
}

/* 値段の隔たり。倍率で見る（¥800→¥1,600 と ¥4,000→¥8,000 は同じ「倍」）。
   味だけで選ぶと、¥1,000台の豆の次に ¥10,000超のゲイシャが出る。
   味は近くても次の一杯には選びにくいので、離れるほど後ろに下げる。
   値段が取れていない豆（0円）は判断材料が無いので、この項は効かせない。 */
function priceGap(a, b) {
  const pa = per100JPY(a), pb = per100JPY(b);
  if (!(pa >= 1) || !(pb >= 1)) return 0;
  return Math.min(Math.abs(Math.log2(pb / pa)) * 8, 30);   // 2倍で8、4倍で16、頭打ち30
}

/* 近さ。小さいほど近い。
   味の座標の距離を土台に、系統が違えば遠ざけ、値段が離れていれば下げ、
   同じ店の豆も少し遠ざける。同じ店ばかり出ると「その店の棚」を見ているのと
   変わらず、世界中から探すという趣旨から外れるため。 */
function distance(a, b) {
  const ca = coordOf(a), cb = coordOf(b);
  const d = Math.hypot(ca.fx - cb.fx, ca.fy - cb.fy);
  return d + (ca.fam === cb.fam ? 0 : 18) + priceGap(a, b) + (a.r === b.r ? 12 : 0);
}

// 買いに行ける豆だけを候補にする（送客が目的なので、買えないものを勧めない）
function candidates(bean) {
  return BEANS.filter((b) =>
    b.id !== bean.id && b.status === "now" && ROASTERS[b.r] && ROASTERS[b.r].url);
}

const nearest = (bean, list) =>
  list.reduce((best, b) =>
    (best === null || distance(bean, b) < distance(bean, best)) ? b : best, null);

const BLEND = "ブレンド";

/* 戻り値は { sameOrigin, similar }。見つからない方は null。
   産地が「ブレンド」の豆は土地が特定できないので、同じ産地の枠は出さない。

   「似た味わい」側はブレンドを候補にしない。画面には「別の産地」と書いてあり、
   ブレンドは産地ではないので、そのまま出すと表示と中身が食い違う。
   （ブレンドの豆を見ているときも、単一産地を出す方が「次」になる） */
export function nextCupFor(bean) {
  if (!bean) return { sameOrigin: null, similar: null };
  const pool = candidates(bean);

  const sameOrigin = (!bean.origin || bean.origin === BLEND)
    ? null
    : nearest(bean, pool.filter((b) => b.origin === bean.origin));

  const similar = nearest(bean, pool.filter((b) =>
    b.origin && b.origin !== BLEND && b.origin !== bean.origin
    && (!sameOrigin || b.id !== sameOrigin.id)));

  return { sameOrigin, similar };
}
