// 味の記録の分析とおすすめ（オンデバイス・診断/マイページ共用）
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";
import { flavorOf } from "../data/flavors";
import { roasterProfiles, FEATURES } from "./roasterProfile";
import { ORIGIN_GROUP, GROUP_LABEL } from "./originGroup";

// 読み込み元を1か所にしたいので、ここからも出しておく（既存の import を壊さない）
export { ORIGIN_GROUP, GROUP_LABEL };

/* 店の特徴量。以前はここで紹介文から作っていたが、いま並んでいる豆から
   数えるように変えた（理由と実測は roasterProfile.js に書いてある）。 */
export function featureOf(rOrKey) {
  const { feats } = roasterProfiles();
  const key = typeof rOrKey === "string" ? rOrKey
    : Object.keys(ROASTERS).find((k) => ROASTERS[k] === rOrKey);
  return feats[key] || Object.fromEntries(FEATURES.map((f) => [f, 0]));
}

/* 記録から好みのベクトルを作る。高評価ほど正、低評価ほど負。
 *
 * 最後に長さをそろえているのが要点。以前は記録が増えるほどベクトルが
 * 際限なく伸びて、200件も付けた人は今日の回答（重み合計で 5〜8 程度）が
 * 完全に埋もれた。向きだけを受け取り、強さは呼ぶ側が決める。 */
export function analyzeTastings(tastings) {
  const attr = {}, aff = {}, proc = {}, fam = {}, grp = {};
  const add = (o, k, v) => { o[k] = (o[k] || 0) + v; };
  let rated = 0;
  for (const t of tastings) {
    if (!t.rating) continue;
    rated++;
    const bean = BEANS.find((b) => b.id === t.beanId);
    const w = (t.rating - 2.5) * 0.8;
    if (Math.abs(w) < 0.01) continue;
    const og = ORIGIN_GROUP(t.origin || (bean && bean.origin) || "");
    if (og) { add(attr, og, w * 1.2); if (w > 0) add(grp, og, 1); }
    const p = bean ? bean.process : "";
    if (/Natural|Honey/i.test(p)) { add(attr, "natural", w); if (w > 0) add(proc, "Natural/Honey", 1); }
    else if (/Washed/i.test(p)) { add(attr, "clean", w * 0.8); if (w > 0) add(proc, "Washed", 1); }
    if (/Anaerobic/i.test(p)) add(attr, "experimental", w);
    if (bean && (bean.vt === "geisha" || bean.vt === "sidra")) add(attr, "geisha", w);
    const r = t.r && ROASTERS[t.r];
    if (r) {
      if (r.country === "JP") add(attr, "domestic", w * 0.6);
      if (r.region === "eastAsia" || r.region === "seAsiaIndia") add(attr, "asia", w * 0.5);
      const rf = featureOf(t.r);
      if (rf.light > 0.7) add(attr, "light", w * 0.6); else if (rf.medium > 0.7) add(attr, "medium", w * 0.5);
      if (w > 0) add(aff, t.r, w * 0.8);
    }
    const fm = bean ? flavorOf(bean) : null;   // ノートがある豆も分析に効くように
    if (fm && w > 0) add(fam, fm.fam, w);
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { attr: unit(attr), aff, rated, topGroup: top(grp), topProc: top(proc), topFam: top(fam) };
}

/* ベクトルの長さを1にする（向きだけ残す）。すべて0なら触らない。 */
function unit(v) {
  const len = Math.sqrt(Object.values(v).reduce((a, b) => a + b * b, 0));
  if (!len) return v;
  const out = {};
  for (const [k, x] of Object.entries(v)) out[k] = x / len;
  return out;
}

/* 好みのベクトルで、いま買える豆のある店を相性順に並べる。
   店ごとの好み(aff)は、記録が増えても効きすぎないよう頭打ちにする。

   onlyJP は点数ではなく絞り込み。「国内でさっと届いてほしい」は好みの強弱では
   なく条件で、どれだけ味が合っても海外の店では答えにならない。 */
export function scoreRoasters(attr, aff = {}, { onlyJP = false, affWeight = 1.2 } = {}) {
  const { keys, feats } = roasterProfiles();
  return keys
    .filter((k) => !onlyJP || ROASTERS[k].country === "JP")
    .map((k) => {
      let s = 0;
      for (const [f, v] of Object.entries(attr)) s += v * (feats[k][f] || 0);
      s += Math.tanh((aff[k] || 0) / 3) * affWeight;
      return [k, s];
    })
    .sort((a, b) => b[1] - a[1]);
}

export function recommendRoasters(analysis, n = 3) {
  if (!analysis || !analysis.rated) return [];
  // 記録だけで並べるので、向きだけのベクトルを診断の回答と同じ強さまで伸ばす
  const attr = {};
  for (const [f, v] of Object.entries(analysis.attr)) attr[f] = v * 6;
  return scoreRoasters(attr, analysis.aff).slice(0, n).map((x) => x[0]);
}
