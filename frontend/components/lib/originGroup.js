/* 産地名 → 大きな括り。
   店の特徴（roasterProfile）と記録の分析（analysis）の両方から使うので、
   どちらにも属さない小さなモジュールに置いて、輪になった読み込みを避ける。 */
export const ORIGIN_GROUP = (o = "") => {
  if (/エチオピア|ケニア|ルワンダ|ブルンジ|タンザニア/.test(o)) return "africa";
  if (/コロンビア|ブラジル|グアテマラ|コスタリカ|メキシコ|ペルー|パナマ|エルサルバドル|ホンジュラス|ボリビア|ニカラグア|エクアドル/.test(o)) return "latam";
  if (/インドネシア|ベトナム|インド|中国|タイ|東ティモール|パプア/.test(o)) return "asia";
  return null;
};

export const GROUP_LABEL = { africa: "アフリカ系", latam: "中南米系", asia: "アジア系" };
