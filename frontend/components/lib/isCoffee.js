// 巡回クローラが各ECから取り込む商品には、コーヒー豆以外（サブスク・器具・マグ・
// ミルク・ギフト券・イベント等）が混ざる。豆だけを図鑑に残すための判定。
// 精製・焙煎の記述（"Washed Filter" / "Espresso" 等）はコーヒーなので除外しない。
const NON_COFFEE = [
  /subscription|サブスク|定期便|頒布会/,
  /gift ?card|ギフトカード|ギフト券|商品券|\bvoucher\b|e-?gift|gift ?set|ギフトセット/,
  /t-?shirt|\btee\b|tシャツ|hoodie|パーカー|sweatshirt|crewneck|beanie|\bsocks\b|靴下|\btote\b|トートバッグ|エコバッグ|apron|エプロン|enamel pin|keychain|キーホルダー|\bsticker\b|ステッカー|\bcap\b|\bbeanie\b/,
  /\bmug\b|マグカップ|tumbler|タンブラー|\bglass(es)?\b|グラス|\bbottle\b|ボトル|flask|thermos|水筒|carafe|カラフェ|decanter|デカンタ|demitasse|\bcup\b|カップ|\bglassware\b/,
  /grinder|グラインダー|コーヒーミル|dripper|ドリッパー|\bv-?60\b|kalita|カリタ|chemex|ケメックス|\bkono\b|hario|ハリオ|aeropress|エアロプレス|french ?press|フレンチプレス|moka ?pot|マキネッタ|kettle|ケトル|gooseneck|\bscale\b|スケール|はかり|server\b|サーバー|ドリップポット|\bbrewer\b|ブリューワー|paper ?filter|filter ?paper|ペーパーフィルター|フィルターペーパー|ネルフィルター|canister|キャニスター|tamper|タンパー|portafilter|\bspoon\b|スプーン|\bscoop\b/,
  /oat ?milk|barista ?milk|almond ?milk|soy ?milk|オーツミルク|バリスタミルク|アーモンドミルク|豆乳|牛乳|ミルクピッチャー|milk ?pitcher/,
  /public cupping|cupping (session|event|class|masterclass)|カッピング会|\bworkshop\b|ワークショップ|\bseminar\b|セミナー|\bticket\b|チケット|\blesson\b|レッスン|masterclass|\bcourse\b|\bevent\b|イベント|experience|体験/,
  /\bbook\b|書籍|magazine|マガジン|\bzine\b/,
  /merch\b|グッズ/,
];

// コーヒー豆（＝図鑑に載せる）なら true
export function isCoffeeBean(bean) {
  const raw = (bean && bean.name) || "";
  const n = raw.replace(/&#8211;/g, "-").replace(/&#038;/g, "&").replace(/&amp;/g, "&").toLowerCase();
  if (/cup of excellence|\bcoe\b/.test(n)) return true; // COEはコーヒー
  return !NON_COFFEE.some((re) => re.test(n));
}
