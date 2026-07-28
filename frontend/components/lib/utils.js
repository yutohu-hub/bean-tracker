// 送客リンク（roaster の EC URL に utm パラメータを付与）
export function shopHref(roaster) {
  if (!roaster || !roaster.url) return null;
  const base = roaster.url.startsWith("http") ? roaster.url : "https://" + roaster.url;
  const sep = base.indexOf("?") === -1 ? "?" : "&";
  return base + sep + "utm_source=beantracker&utm_medium=referral&utm_campaign=go";
}

// Google マップで店を開く（店名＋都市で検索。座標は都市レベルのため名称検索が正確）
export function mapHref(roaster) {
  if (!roaster) return null;
  const q = [roaster.name, (roaster.city || "").replace(/\s*\/\s*/g, " ")].filter(Boolean).join(" ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

// 更新から24時間以内なら NEW（巡回システムが bean.updatedAt を ISO/epoch で設定）
export function isNew(bean, now = Date.now()) {
  if (!bean || !bean.updatedAt) return false;
  const t = typeof bean.updatedAt === "number" ? bean.updatedAt : Date.parse(bean.updatedAt);
  if (isNaN(t)) return false;
  const diff = now - t;
  return diff < 24 * 60 * 60 * 1000 && diff >= -60 * 60 * 1000; // 直近24h（軽微な未来ズレ許容）
}

const UTM = "utm_source=beantracker&utm_medium=referral&utm_campaign=go";

/* 海外ECの検索に渡すとき、産地名の日本語を英語に置き換える。
   これが無いと "エチオピア Lot" が "Lot" だけになって検索が役に立たない。
   海外ロースターの銘柄名に出てくる日本語は産地名とブレンドだけなので、この表で足りる。 */
const JA_EN = {
  "エチオピア": "Ethiopia", "ケニア": "Kenya", "コロンビア": "Colombia", "パナマ": "Panama",
  "グアテマラ": "Guatemala", "ブラジル": "Brazil", "メキシコ": "Mexico", "ペルー": "Peru",
  "コスタリカ": "Costa Rica", "ルワンダ": "Rwanda", "エクアドル": "Ecuador",
  "インドネシア": "Indonesia", "ベトナム": "Vietnam", "インド": "India", "中国": "China",
  "台湾": "Taiwan", "タイ": "Thailand", "フィリピン": "Philippines", "ブレンド": "Blend",
};
// 長い語から先に置換する（インドネシアがインドで切られないように）
const JA_EN_RE = new RegExp(Object.keys(JA_EN).sort((a, b) => b.length - a.length).join("|"), "g");

/* ECの店内検索に渡す語をつくる。
   日本のECは日本語の商品名で登録されているので、銘柄名をそのまま渡す。
   海外のECに "エチオピア イルガチェフェ" を渡しても0件になるので、
   海外店に対してだけ、かな・漢字と "3位" のような注記を落として英字部分を送る。
   落とした結果が短すぎて検索に使えないときは "" を返し、呼び出し側でトップ送客に落とす。 */
export function beanQuery(bean, roaster) {
  if (!bean || !bean.name) return "";
  const name = bean.name.trim();
  if (roaster && roaster.country === "JP") return name;
  const q = name
    .replace(/\d+\s*位/g, " ")                        // "COE 3位" の順位表記
    .replace(/[（(][^）)]*[）)]/g, " ")                // 括弧の注記
    .replace(JA_EN_RE, (w) => ` ${JA_EN[w]} `)         // 産地名は英語に置き換える
    .replace(/[　-鿿＀-￯]/g, " ")    // 残ったかな・漢字・全角記号
    .replace(/\s+/g, " ")
    .trim();
  // 記号や1文字だけが残った場合は検索語として役に立たない
  return /[A-Za-zÀ-ɏ]{3,}/.test(q) ? q : "";
}

/* 豆⇄ECの連動レベル。UIで「商品ページへ直行」か「検索結果へ」かを出し分ける。
   direct = 商品ページのURLを確認済み / search = 店内検索 / shop = トップのみ */
export function beanLinkKind(roaster, bean) {
  if (!roaster || !roaster.url) return "none";
  if (bean && bean.link) return "direct";
  if (roaster.platform === "Shopify" && beanQuery(bean, roaster)) return "search";
  return "shop";
}

// 豆ダイレクト送客。商品ページのURLがあれば直行、無ければ店内検索、それも無理ならトップ。
export function beanHref(roaster, bean) {
  if (!roaster || !roaster.url) return null;
  const kind = beanLinkKind(roaster, bean);
  if (kind === "direct") {
    const sep = bean.link.indexOf("?") === -1 ? "?" : "&";
    return bean.link + sep + UTM;
  }
  if (kind !== "search") return shopHref(roaster); // トップへ安全に送客（utm付き）
  const raw = roaster.url.startsWith("http") ? roaster.url : "https://" + roaster.url;
  let origin;
  try { origin = new URL(raw).origin; } catch { origin = raw.replace(/\/+$/, ""); }
  // type=product で商品だけに絞る（ブログや固定ページを混ぜない）
  return `${origin}/search?q=${encodeURIComponent(beanQuery(bean, roaster))}&type=product&${UTM}`;
}
