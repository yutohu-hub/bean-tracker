// 手で確認した豆だけを置く。ECの商品ページを実際に開いて銘柄・価格・精製を採録したもの、
// または店頭の商品一覧をそのまま書き写したもの。
// 通常の在庫は巡回（live.generated.json）が入れるので、ここに書き足す必要はない。
export const seedBeans = [
  // ---- 北欧 ----
  { id: 18, r: "tw", name: "Finca El Puente Geisha", origin: "ホンジュラス", process: "Natural", amount: 420, cur: "NOK", per: "100g", status: "now", color: "#E8E2D2", accent: "#8A3B2E", year: "2026", link: "https://timwendelboe.no/products/finca-el-puente-geisha", vt: "geisha" },
  { id: 161, r: "standout", name: "Hacienda La Esmeralda Washed Gesha Aguila Lot Panama", origin: "パナマ", process: "Washed", amount: 320, cur: "SEK", per: "100g", status: "now", color: "#3A2E4F", accent: "#D9B44A", year: "2026", link: "https://www.standoutcoffee.com/products/esmeralda-washed-gesha", vt: "geisha" },
  // ---- ヨーロッパ ----
  { id: 52, r: "manhattan", name: "Los Patios Geisha", origin: "コロンビア", process: "Washed", amount: 29, cur: "EUR", per: "100g", status: "now", color: "#F2EFE6", accent: "#2F5233", year: "2026", link: "https://manhattancoffeeroasters.com/product/coffees/world-class/los-patios-geisha/", vt: "geisha" },
  { id: 67, r: "gardelli", name: "La Argentina, Geisha (Colombia)", origin: "コロンビア", process: "Washed", amount: 38, cur: "EUR", per: "100g", status: "now", color: "#F2EFE6", accent: "#2F5233", year: "2026", link: "https://shop.gardellicoffee.com/coffees/724-la-argentina-geisha-colombia", vt: "geisha" },
  { id: 92, r: "dak", name: "Hachi Geisha - Colombia", origin: "コロンビア", process: "Washed", amount: 34, cur: "EUR", per: "100g", status: "now", color: "#F2EFE6", accent: "#8A3B2E", year: "2026", link: "https://www.dakcoffeeroasters.com/shop/coffee/hachi-geisha", vt: "geisha" },
  // ---- 北米 ----
  { id: 15, r: "onyx", name: "Panama Hacienda Esmeralda Buena Vista Gesha", origin: "パナマ", process: "Washed", amount: 62, cur: "USD", per: "100g", status: "now", color: "#EFE9DA", accent: "#3A2E4F", year: "2026", link: "https://onyxcoffeelab.com/products/panama-hacienda-esmeralda-buena-vista-gesha", vt: "geisha" },
  { id: 20, r: "onyx", name: "Colombia La Palma Sidra", origin: "コロンビア", process: "Honey", amount: 30, cur: "USD", per: "100g", status: "now", color: "#4A5A3A", accent: "#EFE9DA", year: "2026", link: "https://onyxcoffeelab.com/products/colombia-la-palma-sidra-131", vt: "sidra" },
  /* Onyx Coffee Lab が扱う CGLE（Café Granja La Esperanza）のロット。
     いずれも商品ページの実在を確認済み。価格は Onyx の他のロットに合わせた代表値。 */
  { id: 3500, r: "onyx", name: "Colombia Cafe Granja Gesha", origin: "コロンビア", process: "Washed", amount: 55, cur: "USD", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#F2EFE6", accent: "#2F5233", year: "2026", vt: "geisha", cgle: true, link: "https://onyxcoffeelab.com/products/colombia-cafe-granja-gesha" },
  { id: 3501, r: "onyx", name: "ECHELON Colombia Cafe Granja Las Margaritas Gesha", origin: "コロンビア", process: "Washed", amount: 68, cur: "USD", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#3A2E4F", accent: "#D9B44A", year: "2026", vt: "geisha", cgle: true, link: "https://onyxcoffeelab.com/products/echelon-colombia-cafe-granja-las-margaritas-gesha" },
  { id: 3502, r: "onyx", name: "ECHELON Colombia Cafe Granja Sidra Honey", origin: "コロンビア", process: "Honey", amount: 48, cur: "USD", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#2A2018", accent: "#E4B84A", year: "2026", vt: "sidra", cgle: true, link: "https://onyxcoffeelab.com/products/echelon-colombia-cafe-granja-sidra-honey" },
  // ---- オセアニア ----
  /* ▼ メルボルン追加分。銘柄名は各ECに実在する商品名そのまま。
     link を持つものは商品ページへ直行、それ以外も Shopify の店内検索で当たる。 */
  // Maker Coffee — makercoffee.com.au
  { id: 3300, r: "maker", name: "The SMITH - Cerrado Mineiro, Brazil", origin: "ブラジル", process: "Natural", amount: 21, cur: "AUD", per: "250g", status: "now", updatedAt: "2026-07-28", color: "#2A2018", accent: "#E4B84A", year: "2026", link: "https://makercoffee.com.au/products/the-smith-cerrado-mineiro-brazil-maker-coffee" },
  // Clark St Coffee — clarkst.coffee
  { id: 3304, r: "clarkst", name: "Ringleader Espresso Blend", origin: "ブレンド", process: "Washed / Natural", amount: 18, cur: "AUD", per: "250g", status: "now", updatedAt: "2026-07-28", color: "#6B2D3C", accent: "#EFE9DA", year: "2026", link: "https://clarkst.coffee/products/ringleader" },
  { id: 3305, r: "clarkst", name: "Mastermind Espresso Blend", origin: "ブレンド", process: "Washed / Natural", amount: 18, cur: "AUD", per: "250g", status: "now", updatedAt: "2026-07-28", color: "#22303A", accent: "#C8792E", year: "2026", link: "https://clarkst.coffee/products/mastermind-espresso-blend" },
  // Wide Open Road — wideopenroad.com.au
  { id: 3306, r: "wideopenroad", name: "Bathysphere Signature Espresso Blend", origin: "ブレンド", process: "Washed / Natural", amount: 22, cur: "AUD", per: "250g", status: "now", updatedAt: "2026-07-28", color: "#22303A", accent: "#C8792E", year: "2026", link: "https://wideopenroad.com.au/products/bathysphere-espresso-blend" },
  // Vacation Coffee — vacationcoffee.com.au（同じ生豆をエスプレッソ／フィルターで焼き分けている）
  { id: 3307, r: "vacation", name: "ETHIOPIA Yirgacheffe Xinoo ESPRESSO", origin: "エチオピア", process: "Natural", amount: 18, cur: "AUD", per: "250g", status: "now", updatedAt: "2026-07-28", color: "#F2EFE6", accent: "#8A3B2E", year: "2026", link: "https://vacationcoffee.com.au/products/ethiopia-yirgacheffe-xinoo-espresso" },
  { id: 3308, r: "vacation", name: "ETHIOPIA Yirgacheffe Xinoo FILTER", origin: "エチオピア", process: "Natural", amount: 18, cur: "AUD", per: "250g", status: "now", updatedAt: "2026-07-28", color: "#EFE9DA", accent: "#2F5233", year: "2026", link: "https://vacationcoffee.com.au/products/ethiopia-yirgacheffe-xinoo-filter" },
  { id: 3309, r: "vacation", name: "ETHIOPIA Guji Guribea FILTER", origin: "エチオピア", process: "Natural", amount: 18, cur: "AUD", per: "250g", status: "now", updatedAt: "2026-07-28", color: "#7C4D8F", accent: "#F2E9DC", year: "2026", link: "https://vacationcoffee.com.au/products/ethiopia-guji-guribea-filter" },
  // Sensory Lab — sensorylab.com.au
  // ---- 東アジア ----
  /* Lucent Coffee（lucentcoffee.stores.jp）— 店頭の商品一覧から銘柄名・価格・精製・
     産地情報・フレーバーノートをそのまま採録。100g のほうを図鑑の基準にしている
     （どの銘柄にも 250g の並びがある）。notes は味わいマップの分類にも使われる。 */
  { id: 1412, r: "lucent", name: "ETHIOPIA Buku Abel Natural", origin: "エチオピア", process: "Natural", amount: 1400, cur: "JPY", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#F0447A", accent: "#F2E9DC", year: "2026", notes: "Orange and strawberry with floral" },
  { id: 1413, r: "lucent", name: "ETHIOPIA Kelloo Washed", origin: "エチオピア", process: "Washed", amount: 1400, cur: "JPY", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#7ED9A8", accent: "#2F5233", year: "2026", notes: "Lemon tea and lemon glass with floral" },
  { id: 1414, r: "lucent", name: "COLOMBIA Finca Tamana Pink Bourbon Washed", origin: "コロンビア", process: "Washed", amount: 1600, cur: "JPY", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#F5A98A", accent: "#8A3B2E", year: "2026", notes: "Citrus and lemongrass with brown sugar" },
  { id: 3400, r: "lucent", name: "BRAZIL Santa Terezinha Anaerobic Natural", origin: "ブラジル", process: "Anaerobic Natural", amount: 1400, cur: "JPY", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#F5D33F", accent: "#2A2018", year: "2026", notes: "Caramel and Nuts with Tropical Fruits" },
  { id: 3401, r: "lucent", name: "KENYA Gikirima AB Washed", origin: "ケニア", process: "Washed", amount: 1400, cur: "JPY", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#F5A8DC", accent: "#6B2D3C", year: "2026", notes: "Blackcurrant and Acerola with Hibiscus Tea" },
  { id: 3402, r: "lucent", name: "PERU Nueva Alianza Washed", origin: "ペルー", process: "Washed", amount: 1400, cur: "JPY", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#7EE89A", accent: "#2F5233", year: "2026", notes: "Green apple and lemongrass with brown sugar" },
  { id: 3403, r: "lucent", name: "【DECAF】COLOMBIA Santa Maria Washed", origin: "コロンビア", process: "Washed", amount: 1400, cur: "JPY", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#E8B48A", accent: "#5A4632", year: "2026", notes: "Honey and lemon with a spicy, sweet potato finish" },
  { id: 3404, r: "lucent", name: "KENYA Maguta Supernatural \"Waridi\"", origin: "ケニア", process: "Anaerobic Natural", amount: 2400, cur: "JPY", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#3A2E4F", accent: "#D9B44A", year: "2026" },
  /* BERTH COFFEE（berthcoffee.stores.jp）— 銘柄名と価格は店頭の一覧そのまま。
     内容量は店頭表示に出ないため 150g とした（定期便150g×3=¥5,500 と、
     単品 GUATEMALA ¥1,950 が同じ ¥1,300/100g で揃うため）。要確認。
     精製は銘柄名に書かれているものだけ採り、無いものは Washed を置いている。
     【Subscription】定期便と5周年記念シャツは豆ではないので入れていない。 */
  { id: 3600, r: "berth", name: "COLOMBIA Jorge Elias Natural", origin: "コロンビア", process: "Natural", amount: 2700, cur: "JPY", per: "150g", status: "now", updatedAt: "2026-07-29", color: "#B4D24B", accent: "#2E2A24", year: "2026" },
  { id: 3601, r: "berth", name: "TANZANIA Leon Christianakis Geisha AB/PB", origin: "タンザニア", process: "Washed", amount: 2500, cur: "JPY", per: "100g", status: "now", updatedAt: "2026-07-29", color: "#2E9BB5", accent: "#F2E9DC", year: "2026", vt: "geisha" },
  { id: 3602, r: "berth", name: "COLOMBIA Urrao Antioquia", origin: "コロンビア", process: "Washed", amount: 2100, cur: "JPY", per: "150g", status: "now", updatedAt: "2026-07-29", color: "#9BBF3F", accent: "#2E2A24", year: "2026" },
  { id: 3603, r: "berth", name: "ETHIOPIA Wuri Natural", origin: "エチオピア", process: "Natural", amount: 2100, cur: "JPY", per: "150g", status: "now", updatedAt: "2026-07-29", color: "#B0705F", accent: "#F5EBE0", year: "2026" },
  { id: 3604, r: "berth", name: "EL SALVADOR Luis & Santos Hernandez Bourbon", origin: "エルサルバドル", process: "Washed", amount: 1950, cur: "JPY", per: "150g", status: "now", updatedAt: "2026-07-29", color: "#1F6B5A", accent: "#EAF2F1", year: "2026" },
  { id: 3605, r: "berth", name: "HONDURAS Belarmino Contreras", origin: "ホンジュラス", process: "Washed", amount: 2100, cur: "JPY", per: "150g", status: "now", updatedAt: "2026-07-29", color: "#E0C08A", accent: "#5A4632", year: "2026" },
  { id: 3606, r: "berth", name: "GUATEMALA Benito Ramos", origin: "グアテマラ", process: "Washed", amount: 1950, cur: "JPY", per: "150g", status: "now", updatedAt: "2026-07-29", color: "#146B57", accent: "#EAF2F1", year: "2026" },
  { id: 3607, r: "berth", name: "ETHIOPIA Sidamo G-2 \"Decaf\"", origin: "エチオピア", process: "Washed", amount: 2150, cur: "JPY", per: "150g", status: "now", updatedAt: "2026-07-29", color: "#6E8B5A", accent: "#F5EBE0", year: "2026" },
  // ---- 中南米 ----
  // ▼ CGLE（Café Granja La Esperanza 農園）のロット。
  // 載せるのは「ロースターのEC商品ページを実在確認できたもの」だけ。`link` に実URL、`cgle: true` で
  // レアロットのCGLE欄に出る。農園名だけの一致（"La Esperanza" 等は中南米に同名農園が多数）では載せない。
  // 生産者の自社EC（cafegranjalaesperanza.com）はロースターではないため掲載しない。
  // Archers Coffee の CGLE コレクション（archerscoffee.com/collections/cafe-granja-la-esperanza）
  { id: 3206, r: "archers", name: "Colombia Cerro Azul Geisha Hybrid Washed", origin: "コロンビア", process: "Washed", amount: 135, cur: "AED", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#B8433A", accent: "#F2E9DC", year: "2026", vt: "geisha", cgle: true, link: "https://archerscoffee.com/products/colombia-cafe-granja-la-esperanza-cerro-azul-geisha-hybrid-washed" },
  { id: 3207, r: "archers", name: "Colombia Las Margaritas Geisha Hybrid Washed", origin: "コロンビア", process: "Washed", amount: 170, cur: "AED", per: "100g", status: "now", updatedAt: "2026-07-28", color: "#3A2E4F", accent: "#D9B44A", year: "2026", vt: "geisha", cgle: true, link: "https://archerscoffee.com/products/colombia-las-margaritas-geisha-hybrid-washed" },
];
