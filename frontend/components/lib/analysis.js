// 味の記録の分析・ロースター特徴量・おすすめ算出（オンデバイス・診断/マイページ共用）
import { ROASTERS } from "../data/roasters";
import { BEANS } from "../data/beans";
import { FLAVOR_MAP } from "../data/flavors";

// ロースターの特徴量（style / focus / region / ship から算出）
export function featureOf(r) {
  const s = r.style || "", f = r.focus || "", reg = r.region || "";
  const light = /極浅/.test(s) ? 1 : /浅煎り/.test(s) ? (/中/.test(s) ? 0.7 : 0.9) : /中深|深/.test(s) ? 0 : 0.4;
  const medium = /中浅|中煎り/.test(s) ? 1 : /浅〜中|浅\/中/.test(s) ? 0.7 : 0.4;
  const africa = /エチオピア|ケニア|ルワンダ/.test(f) || reg === "africaMideast" ? 1 : 0;
  const latam = /コロンビア|ブラジル|グアテマラ|コスタリカ|メキシコ|ペルー|パナマ/.test(f) || reg === "latinAmerica" ? 1 : 0;
  const asia = reg === "eastAsia" || reg === "seAsiaIndia" ? 1 : 0;
  const geisha = /ゲイシャ|希少/.test(f) ? 1 : 0;
  const experimental = geisha ? 1 : /実験|アナエロビック|anaerobic/i.test(s + f) ? 1 : 0;
  const domestic = /国内/.test(r.ship || "") ? 1 : 0;
  return { light, medium, africa, latam, asia, geisha, experimental, domestic, natural: geisha ? 0.6 : 0.4, clean: 0.6 };
}

export const ORIGIN_GROUP = (o = "") => {
  if (/エチオピア|ケニア|ルワンダ|ブルンジ|タンザニア/.test(o)) return "africa";
  if (/コロンビア|ブラジル|グアテマラ|コスタリカ|メキシコ|ペルー|パナマ|エルサルバドル|ホンジュラス|ボリビア|ニカラグア|エクアドル/.test(o)) return "latam";
  if (/インドネシア|ベトナム|インド|中国|タイ|東ティモール|パプア/.test(o)) return "asia";
  return null;
};
export const GROUP_LABEL = { africa: "アフリカ系", latam: "中南米系", asia: "アジア系" };

// 高評価ほど正、低評価ほど負の重みで、記録から好み特徴量・ロースター親和・要約を作る
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
      if (/国内/.test(r.ship || "")) add(attr, "domestic", w * 0.6);
      if (r.region === "eastAsia" || r.region === "seAsiaIndia") add(attr, "asia", w * 0.5);
      const rf = featureOf(r);
      if (rf.light > 0.7) add(attr, "light", w * 0.6); else if (rf.medium > 0.7) add(attr, "medium", w * 0.5);
      if (w > 0) add(aff, t.r, w * 0.8);
    }
    const fm = FLAVOR_MAP[t.beanId];
    if (fm && w > 0) add(fam, fm.fam, w);
  }
  const top = (o) => Object.entries(o).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  return { attr, aff, rated, topGroup: top(grp), topProc: top(proc), topFam: top(fam) };
}

// 分析(attr/aff)から、いま買える豆のあるロースターを相性順に上位n件
export function recommendRoasters(analysis, n = 3) {
  if (!analysis || !analysis.rated) return [];
  const liveKeys = new Set(BEANS.filter((b) => b.status === "now").map((b) => b.r));
  return Object.keys(ROASTERS)
    .filter((k) => liveKeys.has(k))
    .map((k) => {
      const rf = featureOf(ROASTERS[k]);
      let s = 0;
      for (const [f, v] of Object.entries(analysis.attr)) s += v * (rf[f] || 0);
      s += (analysis.aff[k] || 0) * 1.0;
      return [k, s];
    })
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map((x) => x[0]);
}
