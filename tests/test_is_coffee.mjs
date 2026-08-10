/* 豆かどうかの判定が、あとから壊れないようにする。
 *
 *   node tests/test_is_coffee.mjs
 *
 * ■ なぜ要るのか
 *
 * components/lib/isCoffee.js は「豆でないもの」を並べた一覧で、店が増えるたびに
 * 語を足していく。足した語が広すぎると、本物の豆を巻き添えにする。
 * それは図鑑から静かに消えるだけなので、見て気づくことができない。
 *
 * 実際に危なかったものを、そのまま両側の表に入れてある。
 * - "I Can Hear the Heart Beating as One" … アルバム名の豆。缶の規則に当たりかけた
 * - "生豆商Nordic Approach…淺烘焙" … 生豆を扱う商社の名前が付いた焙煎豆
 * - "Costa Rica La Pacaya Cinnamon" … シナモンは風味の話
 * - "Hatch"・"Manhattan"・"Nightcap" … hat が入っているだけの豆
 * - "Starburst Soda"・"DAK Lemon Spritz" … 飲み物ではなく豆の名前
 * - "Iced Coffee Roast" … アイス用の焙煎＝豆
 *
 * 落とすべき側は、実際に図鑑に並んでいたものを国ごとに1つずつ残している。
 */
import { isCoffeeBean } from "../frontend/components/lib/isCoffee.js";

// 豆ではない。図鑑に出してはいけない
const NOT_COFFEE = [
  // カプセル・ポッド（綴りが国ごとに違う）
  "Birchwood Blend EcoPod™", "Cápsulas Geishify", "Kapsel Moonlight",
  "Traditionel, Kapsler", "Inventory_Capsule Box", "精品膠囊咖啡-10入/盒",
  // 缶・生豆・液体
  "Onyx 500ml Cans", "LYKKE FINEST CAN - Brazil Edivaldo Cunha",
  "Chaz Bear Collaboration Limited Edition Tin Can",
  "San Sebastián - Raw Green Coffee - Mexico", "Green Coffee Beans",
  "【生豆】エルサルバドル トレス・ポソス農園 パカマラ ナチュラル",
  "リキッドコーヒー「オリジナルブレンド」 (720ml)", "Iced Mocha", "Seasonal Espresso Tonic",
  // 器具（英語・仏語・西語・日本語・中国語）
  "Pichet à lait WPM - 450ml", "Jarra leche Rhino inox 600ml", "Karafla 600ml",
  "CAFEC アバカ円すいコーヒーフィルター 100枚入 AC4-100W White 2～4杯用",
  "サイフォン用竹べら", "預購｜聰明濾杯", "聰明濾杯【專用扇形濾紙】",
  "預購｜消光黑【半磅電動磨豆機】", "Tamp Mat", "Cloth Filters", "Lunar Carrying Case",
  // 衣類・布物・紙物
  "Peace Varsity Sock", "Golf Umbrella", "あの子に借りたストライプシャツ｜グレー",
  "銭湯タオル", "【ORIGINAL】今治パイルハンカチ", "紙袋(ショッパー)", "Goodman original cotton 巾着袋",
  // 食品・菓子
  "Dye Free Rainbow Sprinkles 1.5lb", "Kirkland Organic Ground Saigon Cinnamon 10.7 oz",
  "Dried Lime Wheels", "Stevia in the Raw 800ct Packet Box", "Tisane Chamomile",
  "レモンのパウンドケーキ(3個入り)", "綜合堅果-120g/罐", "中秋限定禮盒-咖啡核桃鳳梨酥6入盒",
  // 贈答・催し・書籍・内部ページ
  "台灣精品咖啡禮盒｜冰雪白", "台中市十大伴手禮 ｜初心禮盒組  黃金比例壺精品咖啡禮盒",
  "バリ島コーヒー農園ツアー2026 [7~8月開催]", "2026 邵老師的品種課", "Chacha 村民見面會",
  "焙煎師の詩集「ここじゃないどこか」", "How to Make the Best Coffee at Home",
  "Indy Coffee Guide - South No. 9", "国広さま専用ページ", "【客服部專用-付款賣場】",
  /* 名前に pod が入っているが、落ちる理由は pod ではないもの。
     この表を書いたとき、最初はこれらを「豆」の側に入れていて、テストに叱られた。
     Podi はチョコがけアーモンド、Podback はカプセルの回収袋、Cups は器。 */
  "Coated: Podi Milk Chocolate Almonds", "Podback Drop-Off Bag", "Carrick Cups",
  "E-Karta Podarunkowa JAVA Coffee",
];

// 豆。規則を足したせいで消えては困るもの
const COFFEE = [
  // 過去に規則が当たりかけた豆（新しい語を足すときは、まずここを見る）
  "Yo La Tengo - I Can Hear the Heart Beating as One",   // 缶（can）
  "精選北歐生豆商Nordic ApproachKENYAAA MURUE肯亞AA 魯伊合作社水洗處理220克裝 淺烘焙", // 生豆
  "Costa Rica La Pacaya Cinnamon",                        // シナモン
  "COLOMBIA Santuario Project Campo Hermoso Cinnamon Strawberry",
  "Hatch - Supernova", "Manhattan - Bombe", "Nightcap Decaf", "Kenya, Gichathaini AA", // hat
  "Starburst Soda | Colombia", "DAK Lemon Spritz *Washed Filter*", "Poppy Soda", // 飲み物ではない
  "Iced Coffee Roast",                                    // アイス用の焙煎
  "Gusto - Koffiebonen", "AUGUSTO BORGES ESPRESSO / BRAZIL", // dolce gusto
  // ごく普通の豆
  "Ethiopia Haro Beddame Natural", "Brasil Fazenda Sertão Natural",
  "咖啡豆-淺烘焙 衣索比亞 西達馬 水洗G1 /200g",
  "エチオピア / ウォルカ サカロ 完熟チェリー",
  "【Seasonal Blend 2026】August | Seigaiha Blend (青海波)",
  "堅果郡王(加奶、黑咖啡百搭配方)",                          // 堅果＝風味の話
];

let ng = 0;
for (const name of NOT_COFFEE) {
  if (isCoffeeBean({ name })) { console.log(`✗ 豆でないのに通っている: ${name}`); ng++; }
}
for (const name of COFFEE) {
  if (!isCoffeeBean({ name })) { console.log(`✗ 豆なのに落ちている: ${name}`); ng++; }
}
if (ng) {
  console.log(`\n★ ${ng} 件おかしい。isCoffee.js に足した語が広すぎるか、狭すぎる。`);
  process.exit(1);
}
console.log(`豆でないもの ${NOT_COFFEE.length} 件・豆 ${COFFEE.length} 件、すべて期待どおり。`);
