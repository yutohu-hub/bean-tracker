// 巡回クローラが各ECから取り込む商品には、コーヒー豆以外（サブスク・器具・マグ・
// ミルク・ギフト券・イベント等）が混ざる。豆だけを図鑑に残すための判定。
// 精製・焙煎の記述（"Washed Filter" / "Espresso" 等）はコーヒーなので除外しない。
const NON_COFFEE = [
  /subscription|サブスク|定期便|頒布会/,
  /gift ?card|ギフトカード|ギフト券|商品券|\bvoucher\b|e-?gift|gift ?set|ギフトセット/,
  /t-?shirt|\btee\b|tシャツ|hoodie|パーカー|sweatshirt|crewneck|beanie|\bsocks\b|靴下|\btote\b|トートバッグ|エコバッグ|apron|エプロン|enamel pin|keychain|キーホルダー|\bsticker\b|ステッカー|\bcap\b|\bbeanie\b/,
  /\bmugs?\b|マグカップ|tumbler|タンブラー|\bglass(es)?\b|グラス|\bbottle\b|ボトル|flask|thermos|水筒|carafe|カラフェ|decanter|デカンタ|demitasse|\bcup\b|カップ|\bglassware\b/,
  /grinder|グラインダー|コーヒーミル|dripper|ドリッパー|\bv-?60\b|kalita|カリタ|chemex|ケメックス|\bkono\b|hario|ハリオ|aeropress|エアロプレス|french ?press|フレンチプレス|moka ?pot|マキネッタ|kettle|ケトル|gooseneck|\bscale\b|スケール|はかり|server\b|サーバー|ドリップポット|\bbrewer\b|ブリューワー|paper ?filter|filter ?paper|ペーパーフィルター|フィルターペーパー|ネルフィルター|canister|キャニスター|tamper|タンパー|portafilter|\bspoon\b|スプーン|\bscoop\b/,
  // 器具ブランド・パーツ（コーヒー品種/生産者と紛らわしい語は製品名まで限定）
  // 例: "Acaia"は焙煎品種アカイア、"Fellow Farms"は生産者名なので、器具モデル名がある時だけ除外
  /fellow ?(aiden|tally|atmos|stagg|\bode\b|opus|clara|carter|junior|prismo|shibui|kettle|drop)|acaia ?(pearl|lunar|pyxis|cinco|umbra|orbit)|comandante|コマンダンテ|timemore|タイムモア|1zpresso|weber ?workshop|moccamaster|モカマスター|\bwilfa\b|baratza|niche ?zero|wacaco|picopresso|\bflair\b|breville|gaggia|rancilio|profitec|\blelit\b|xbloom|la ?marzocco|coffee ?maker|espresso ?machine|コーヒーメーカー|エスプレッソマシン|knock ?box|ノックボックス|\bdistributor\b|\bleveler\b|レベラー|\bwdt\b|puck ?screen|bottomless|shower ?screen|\bgasket\b|dosing ?cup|blind ?shaker|milk ?jug|frothing ?pitcher|ミルクピッチャー/,
  // ブリューキット・洗浄・ペーパーフィルターの箱売り・抹茶等
  /\bbrew(ing)? ?kit\b|water ?kit|brew ?water|starter ?kit|descal|cafiza|puly ?caff|cleaning ?(tablet|powder|solution|kit)|クリーナー|洗浄|\bwhisk\b|matcha|抹茶|茶筅/,
  /filters?\s*\([^)]*\d+[^)]*(pack|count|ct|pcs|pk|枚)\b/,   // ○○ Filters (100 Pack) 等の紙フィルター
  /physics of filter coffee/,                                  // 書籍
  /oat ?milk|barista ?milk|almond ?milk|soy ?milk|オーツミルク|バリスタミルク|アーモンドミルク|豆乳|牛乳|ミルクピッチャー|milk ?pitcher/,
  /public cupping|cupping (session|event|class|masterclass)|カッピング会|\bworkshop\b|ワークショップ|\bseminar\b|セミナー|\bticket\b|チケット|\blesson\b|レッスン|masterclass|\bcourse\b|\bevent\b|イベント|experience|体験/,
  /\bbook\b|書籍|写真集|magazine|マガジン|\bzine\b/,
  /merch\b|グッズ/,
  // ティー類（茶・チャイ・カスカラ茶など。コーヒーのフレーバー表記ではなく茶製品）
  /\btea\b|ティー|紅茶|\bchai\b|rooibos|ルイボス|oolong|ウーロン|\bsencha\b|煎茶|genmaicha|玄米茶|hojicha|ほうじ茶|茶葉|loose ?leaf|looseleaf|tea ?bags?|\bkombucha\b|コンブチャ/,
  // ギフト/詰め合わせボックス（"Juice Box"等の豆名や "Open Box" は誤除外しない）
  /gift ?box|ギフトボックス|tasting ?box|taster ?box|sample ?box|\bsampler\b|discovery ?box|assort|collection ?box|selection ?box|twin ?box|box ?set|box of \d+|advent|catalog ?box/,
  // RTD缶・缶飲料（"Cold Brew ... [Roast]"や"Nitrogen Washed"は豆/精製なので除外しない）
  /\bcanned\b|mini ?can\b|can ?chiller|\bchiller\b|\bmiir\b|iced ?latte|\brtd\b|ready.?to.?drink|缶コーヒー/,
  // ドリップバッグ（挽いた粉の個包装。豆ではない）
  /drip ?bags?|ドリップバッグ|drip ?pack|ドリップパック|drip ?coffee ?bag|coffee ?drip ?bag|dripbag/,
  // コールドブリュー・水出し（RTD/濃縮/粉。豆ではない）
  /cold ?brew|コールドブリュー|水出し|アイスコーヒー/,
  // インスタント・フリーズドライ
  /\binstant\b|インスタント|freeze ?dried|フリーズドライ/,
  // アパレル・雑貨・パーツ・お香・ミネラル等（豆ではない物販）
  /\bshirts?\b|\bpants\b|\btrousers\b|\bjacket\b|\bsweater\b|\bbandana\b|\bshoes\b|incen[cs]e|お香|\bhat\b|\bcaps?\b|\bbags?\b|\bsack\b|\bbasket\b|\bjug\b|\bbooster\b|\bmineral\b|ミネラル/,
  // 書籍・教室・サービス・時計・雑貨など明確な非コーヒー
  /the business of specialty|barista hustle|de nieuwe barista|\bby [A-Z][a-z]+ [A-Z][a-z]+$/,
  /\btraining\b|latte ?art|ラテアート|\bworkshop\b|\bclass(es)?\b/,
  /ceramics?|セラミック|陶器|handmade|\bstrap\b|orbitkey|key ?organizer|キーオーガナイザー|organiser/,
  /g-?shock|\btimex\b|\bcasio\b|\bseiko\b|腕時計|\bwatch\b(?!\s*(list|ing))/,
  /invoice|overdue|payment ?arrangement|請求|お支払い|voucher/,
  // チョコレート・焼き菓子等の食品（"Milky Cake"等の豆名やコーヒーの風味表記は除外しない）
  /drinking ?chocolate|chocolate ?bar|ground ?chocolate|chocolate ?(product|strudel|waffle|bark)|板チョコ|specialty ?chocolate|\braaka\b|cocoa ?(bar|powder|nibs)|cacao ?(bar|nibs|powder)|cupcakes?|strudel|waffle ?cone|soft ?bar|croissant/,
  // シロップ・雑貨・パーツ・食器/器具ブランド
  /\bsyrup\b|シロップ|\bposter\b|\bjournal\b|\bpuzzles?\b|repair ?kit|kintsugi|gift ?wrap|wrapping ?paper|\bbrush\b|ブラシ|\blid\b|\bstraw\b|shoelace|\bkinto\b|\bceado\b|\bfetco\b|p[äa]llo/,
  // まだ残っていたコーヒー器具・パーツ（"| Filter |" 等の焙煎表記は除外しない）
  /coffee ?mill|\bcutter\b|stainless ?steel|deodorizer|消臭|\bflannel\b|ネル|\bsibarist\b|\borea\b|flo ?screen|cera ?filter|wave ?filters?|dripkit|key ?holder|\bholder\b|\breplacement\b|zebrang/,
  // 日本語の非コーヒー（ギフト/セット/焼き菓子など。"ブレンド"はコーヒーなので除外しない）
  /ギフト|詰め合わせ|飲み比べ|アソート|福袋|セット|バナナブレッド|ブレッド|焼き菓子|洋菓子|和菓子|クッキー|マフィン|スコーン|ドーナツ|プリン|ビスケット|グラノーラ|カヌレ|マドレーヌ|フィナンシェ/,
];

// コーヒー豆（＝図鑑に載せる）なら true
export function isCoffeeBean(bean) {
  const raw = (bean && bean.name) || "";
  const n = raw.replace(/&#8211;/g, "-").replace(/&#038;/g, "&").replace(/&amp;/g, "&").toLowerCase();
  if (/cup of excellence|\bcoe\b/.test(n)) return true; // COEはコーヒー
  return !NON_COFFEE.some((re) => re.test(n));
}

// 内容量を g に換算（"250g" / "12oz" / "1000g"）
function gramsOf(per) {
  if (!per) return 0;
  const s = String(per);
  if (s.endsWith("oz")) return Math.round(parseFloat(s) * 28.35);
  return parseInt(s) || 0;
}

// 業務用・卸（1kg以上、またはwholesale/bulk/○kg/○lbsの表記）なら true → 図鑑から除外
export function isWholesale(bean) {
  if (gramsOf(bean && bean.per) >= 1000) return true;
  const n = ((bean && bean.name) || "").toLowerCase();
  if (/wholesale|卸売?|業務用|バルク|\bbulk\b|カートン|coffee ?sacks?|\bjute\b/.test(n)) return true;
  const kg = n.match(/(\d+(?:\.\d+)?)\s?kg\b/);      // 1kg 以上
  if (kg && parseFloat(kg[1]) >= 1) return true;
  const lb = n.match(/(\d+(?:\.\d+)?)\s?lbs?\b/);     // 2lb 以上
  if (lb && parseFloat(lb[1]) >= 2) return true;
  return false;
}
