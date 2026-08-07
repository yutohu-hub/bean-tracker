// 巡回クローラが各ECから取り込む商品には、コーヒー豆以外（サブスク・器具・マグ・
// ミルク・ギフト券・イベント等）が混ざる。豆だけを図鑑に残すための判定。
// 精製・焙煎の記述（"Washed Filter" / "Espresso" 等）はコーヒーなので除外しない。
const NON_COFFEE = [
  /subscription|サブスク|定期便|頒布会/,
  /gift ?card|ギフトカード|ギフト券|商品券|\bvoucher\b|e-?gift|gift ?set|ギフトセット/,
  /t-?shirt|\btee\b|tシャツ|hoodie|パーカー|sweatshirt|crewneck|beanie|\bsocks\b|靴下|\btote\b|トートバッグ|エコバッグ|apron|エプロン|enamel pin|keychain|キーホルダー|\bstickers?\b|ステッカー|\bcap\b|\bbeanie\b/,
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
  // 器具ブランド・中古機材・講座。豆ではないのに高額で、価格順の一覧を荒らす
  /\becm ?(puristika|synchronika|mechanika|classika|casa|barista)|\brocket ?(r9|appartamento|mozzafiato|giotto|cinquantotto)/,
  /\bfagor\b|\bprofitec\b|\blelit\b|victoria ?arduino|\bslayer\b|dalla ?corte/,
  /pre-?owned|open-?box|\bex-?demo\b/,
  /sca ?(csp|cds)|brewing ?skills|sensory ?skills|barista ?skills|green ?coffee ?skills|\bcourse\b|講座|セミナー/,
  // テイスティングノートのカード。豆と同じ棚に並ぶが飲めない
  /taste ?cards?|tasting ?cards?|flavou?r ?cards?/,
  // チョコレート・焼き菓子等の食品（"Milky Cake"等の豆名やコーヒーの風味表記は除外しない）
  /drinking ?chocolate|chocolate ?bar|ground ?chocolate|chocolate ?(product|strudel|waffle|bark)|板チョコ|specialty ?chocolate|\braaka\b|cocoa ?(bar|powder|nibs)|cacao ?(bar|nibs|powder)|cupcakes?|strudel|waffle ?cone|soft ?bar|croissant/,
  // シロップ・雑貨・パーツ・食器/器具ブランド
  /\bsyrup\b|シロップ|\bposter\b|\bjournal\b|\bpuzzles?\b|repair ?kit|kintsugi|gift ?wrap|wrapping ?paper|\bbrush\b|ブラシ|\blid\b|\bstraw\b|shoelace|\bkinto\b|\bceado\b|\bfetco\b|p[äa]llo/,
  // まだ残っていたコーヒー器具・パーツ（"| Filter |" 等の焙煎表記は除外しない）
  /coffee ?mill|\bcutter\b|stainless ?steel|deodorizer|消臭|\bflannel\b|ネル|\bsibarist\b|\borea\b|flo ?screen|cera ?filter|wave ?filters?|dripkit|key ?holder|\bholder\b|\breplacement\b|zebrang/,
  // 日本語の非コーヒー（ギフト/セット/焼き菓子など。"ブレンド"はコーヒーなので除外しない）
  /ギフト|詰め合わせ|飲み比べ|アソート|福袋|セット|バナナブレッド|ブレッド|焼き菓子|洋菓子|和菓子|クッキー|マフィン|スコーン|ドーナツ|プリン|ビスケット|グラノーラ|カヌレ|マドレーヌ|フィナンシェ/,
  // カプセル・ポッド（豆ではないので図鑑に出さない。ドリップバッグ・インスタントと同じ扱い）
  /\bcapsules?\b|カプセル|nespresso|ネスプレッソ|\bpods?\b|キャップ式/,
  // 抽出用のミネラル・調整水（豆ではない）。"April Water Minerals" のように店名が付くことがある
  /water ?minerals?|minerals? ?for ?coffee|brew ?water|\bapax\b|\bosmo\b|lotus ?coffee/,
  // 紙フィルター類（"(100 count)" のように枚数が付く。焙煎表記の "Filter" とは区別する）
  /filters? ?\((?:\d+|[^)]*(?:count|ct|pack))/i,
  // 体験・イベント（豆ではない）
  /roastery ?tour|tasting ?tour|coffee ?tasting ?and|\bworkshop ticket\b|\bclass\b ?ticket/,
  // ミルク以外の植物性飲料・食品（"Almond Butter Espresso" は豆なので単体名のときだけ落とす）
  /pistachio|\bbeverage\b|nut ?butter|chocolate ?chips|^almond butter$/,
  // 社内向け・非公開商品
  /\(internal\)|\btest ?product\b/,
  // バリスタ用ツール類（"FELLOW Espresso Tamping Mat" のように器具ブランド名だけでは弾けない）
  /\btools?\b|tamping ?mat|\btamping\b|distribution ?tool|dosing ?funnel|puck ?prep|post-?extraction|pulling ?tool|mahlk[öo]nig/,
  // エナメルピン等のグッズ（"Pink Bourbon" のような品種名には当たらない）
  /\bpins?\b|\bpatch(es)?\b|\bkeyring\b|\bbadges?\b/,
  // 商品ではない行（送料・チップ等）と、コーヒー以外の飲料
  /^shipping$|^timer$|^donation$|配送料|送料|coke ?case|sprite ?case|soda ?case/,

  // ───────────────────────────────────────────────────────────────
  // ここから追補。図鑑に残っていた非コーヒーを、巡回の実データから拾った。
  // どれも「いま買える・EC送客できる豆」として棚に並んでいたもの。
  // ───────────────────────────────────────────────────────────────

  // 器（カップ・ボウル・受け皿・蓋・ストロー・トレー・布巾）。
  // KeepCup / ACME / ORIGAMI / LAMILL / Boram Um など。
  // "Cup of Excellence" は判定の先頭で先に true を返しているので巻き込まない。
  /\bcups?\b|\bbowls?\b|\bsaucers?\b|\blids?\b|keepcup|\btazas?\b|filiżanek|sugerør|termokopp|\bstraws?\b|\btrays?\b|\btowels?\b|tenugui/,

  // 詰め合わせ。複数の豆をまとめた商品で、1銘柄としての産地も値段も決まらない。
  // 既にある セット / assort / sampler / box of N と同じ扱いで図鑑には出さない。
  /\bbundles?\b|set of \d+|pack of \d+|\d+ ?\/ ?case\b|variety ?pack|\bcombo\b/,

  // 器具・機材・部品
  /bialetti|moka ?express|new ?moka|kawiarka|cafetera|aero ?press|thermometer|温度計|dispenser|\bbracket\b|dispersion ?disc|golden ?disc|pump(er|hendel)|spieniacz|frother|milk ?system|airscape|refill ?jar|puq ?press|puqpress|rhinowares?\b|turbo ?chef/,

  // 講座・サービス・修理・販促物
  /barista ?(fundamentals|basics|standards)|brewing ?fundamentals|espresso ?making|consult(ing|ancy|ation)|installation ?service|\brepair\b|gift ?certificate|machine ?demonstration|stamp ?card|brewing ?guides?/,

  // 茶。既にある \btea\b では拾えない書き方（アールグレイ等）
  /earl ?grey|darjeeling|th[ée] ?noir|tykkitee/,

  // チョコレート製品。コーヒーの風味表記まで落とさないよう、％表記・covered・mix が
  // 付くものだけに限る。"Vienna Roast - Dark Roast - Dark Chocolate, Smoke" は豆なので残す。
  /hot ?chocolate|chocolate ?mix|chocolate ?covered|chocolate ?\(\d+ ?%\)|\d+ ?% ?[a-z ]*chocolate|\(\d+ ?% ?dark\)|land ?chocolate|askinosie|vending ?chocolate/,

  // レコード（店頭で物販しているもの）
  /\bvinyl\b/,

  // 清涼飲料・食品・洗剤
  /coke ?zero|sparkling ?water|coconut ?water|pizza ?box|\bcleaner\b/,

  // 抽出用の水と計測器。
  // 精製方法の "Mountain Water Process"（水を使う脱カフェイン）は豆なので落とさない。
  /brewing ?water|third ?wave ?water|\(\d+ ?gal\)|tds ?meter/,

  // 複数本の詰め合わせ（○本パック・テイスターパック等）。
  // 1銘柄として値段も産地も決まらないので、bundle と同じ扱いで出さない。
  /\bpacks?\b|\d+-in-\d+|pack ?size|classic ?set|caffeine ?box|mixed ?box|4'l[üu]/,

  // 定期便（各国語）
  /abonnement|\babo\b|gaveabonnement|kaffeabonnement|suscripci[óo]n|assinatura/,

  // 商品券・ギフト箱（各国語）
  /gutschein|carte ?cadeau|\bcoffret\b|geschenk/,

  // 書籍・教本
  /\blivre\b|\blibro\b|handbook|\bmanuel\b|nez du caf[ée]|physics of espresso/,

  // 全自動機・スケール・洗浄剤・部品（豆ではないのに高額で、価格順の一覧を荒らす）
  /\bscales?\b|automatic (coffee )?machine|machine [àa] caf[ée]|d[ée]tartrant|\bcartridge\b|\bespro\b|coffee ?press|microbalance|felicita|difluid|\beureka\b|cafetto|rensepulver|espresso ?clean|brew ?clean|blind ?filter|brewtool|\bkits?\b/,

  // 食品（チョコ菓子・クッキー・グラノーラ等）。
  // コーヒーの風味表記（"Dark Chocolate, Smoke & Wood"）は落とさないよう、
  // 菓子そのものを指す語だけに限る。
  /chocolate ?chips?|\bcookies?\b|\bbrownie\b|cremeux|tahini|\bcashews?\b|chocolate ?powder|granola|[çc]ikolatal|[çc]ilolatal|cheese ?cake/,

  // 雑貨・バッジ・鍵まわり
  /\bbuttons?\b|\bshopper\b|key ?ring|\bplates?\b|\bspoons?\b/,

  // 瓶詰めのRTD飲料
  /bottled ?chilled|chilled ?beverages?|iced ?classic/,

  // ドリップバッグ（中国語圏の表記）
  /濾掛|掛耳|滤挂|咖啡包/,

  // 紙フィルター・浄水フィルター（仏語）。
  // 英語の "Filter" は焙煎/抽出の区分（"Bookkisa Filter"）なので落とさない。
  // 仏語の複数形 filtres、または filtre + 対象語のときだけ器具とみなす。
  /\bfiltres\b|filtre ?eau|mineralizer/,

  // 講習（仏語）。ただし "Atelier Crenn Blend" は料理人との共同開発の豆なので残す。
  // 先頭が Atelier で、名前のどこにも blend が無いものだけを講習とみなす。
  /^atelier\b(?!.*blend)/,

  // 器（独語・仏語）
  /\btasses?\b|espressotasse|cappuccinotasse|\bbecher\b|\bglas\b|\bbottles?\b/,

  // チョコレート製品の残り。
  // 先頭の％は "100% Arabica" のような豆名にも付きうるので、
  // カカオ含有量の書き方（％＋濃さの語）に限る。
  /^\d+ ?% ?(sweet|classic|dark|milk|white)\b|chocolate ?duo|coffee ?x ?chocolate|^coated:|\(\d+ ?% ?milk\)/,
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
